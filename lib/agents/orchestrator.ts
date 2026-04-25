// lib/agents/orchestrator.ts
// SSE-streaming orchestrator. Coordinates the full agent pipeline for a user
// prompt and emits live status events to the client for the AgentTrace UI.

import { parseIntent } from './intentParse';
import { runDiscovery } from './discovery';
import { runHarvester } from './harvester';
import { runVisionExtractor } from './visionExtractor';
import { runDedup } from './dedup';
import { runRecommender } from './recommender';
import { prisma } from '@/lib/db';
import type { ParsedIntent, ExtractedEvent, CanonicalEvent } from '@/lib/types';

export type AgentEvent =
  | { type: 'status'; agent: AgentName; message: string }
  | { type: 'intent'; intent: ParsedIntent }
  | { type: 'discovery_result'; newSourceCount: number; sources: Array<{ handle: string; relevance: number }> }
  | { type: 'harvest_result'; postCount: number; eventCandidates: number }
  | { type: 'extracted'; event: ExtractedEvent; rawPostId: string }
  | { type: 'merged'; canonical: CanonicalEvent; mergedFromCount: number; trace: string[] }
  | { type: 'recommendation'; eventId: string; score: number; reasoning: string }
  | { type: 'final_result'; eventIds: string[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type AgentName =
  | 'orchestrator'
  | 'intent_parse'
  | 'discovery'
  | 'harvester'
  | 'vision_extractor'
  | 'dedup'
  | 'recommender';

export interface OrchestrateInput {
  prompt: string;
  sessionId: string;
  city: 'nyc' | 'guatemala_city';
  options?: {
    skipDiscovery?: boolean;
    skipHarvest?: boolean;
    extractLimit?: number;
    dedupRecentHours?: number;
  };
}

type Emit = (event: AgentEvent) => void;

export async function orchestrate(input: OrchestrateInput, emit: Emit): Promise<void> {
  const opts = {
    skipDiscovery: input.options?.skipDiscovery ?? true,
    skipHarvest: input.options?.skipHarvest ?? true,
    extractLimit: input.options?.extractLimit ?? 8,
    dedupRecentHours: input.options?.dedupRecentHours ?? 72,
  };

  emit({ type: 'status', agent: 'intent_parse', message: 'Parsing your request...' });
  const intent = await parseIntent({
    userMessage: input.prompt,
    city: input.city,
    sessionId: input.sessionId,
  });
  emit({ type: 'intent', intent });

  if (!opts.skipDiscovery) {
    emit({ type: 'status', agent: 'discovery', message: 'Scanning for new civic sources...' });
    const newSources = await runDiscovery({
      city: input.city,
      causeTags: intent.cause_tags,
      sessionId: input.sessionId,
    });
    emit({
      type: 'discovery_result',
      newSourceCount: newSources.length,
      sources: newSources.map(s => ({ handle: s.handle, relevance: s.civic_relevance })),
    });
  }

  if (!opts.skipHarvest) {
    emit({ type: 'status', agent: 'harvester', message: 'Pulling recent posts from sources...' });
    const harvested = await runHarvester({
      city: input.city,
      sessionId: input.sessionId,
    });
    emit({
      type: 'harvest_result',
      postCount: harvested.totalPosts,
      eventCandidates: harvested.eventCandidates,
    });
  }

  emit({ type: 'status', agent: 'vision_extractor', message: 'Extracting event details from flyers...' });
  const candidatePosts = await fetchUnprocessedEventPosts(input.city, opts.extractLimit);
  const extracted: Array<{ event: ExtractedEvent; rawPostId: string }> = [];
  for (const post of candidatePosts) {
    if (post.image_urls.length === 0) continue;
    const event = await runVisionExtractor({
      imageUrl: post.image_urls[0],
      rawPostId: post.id,
      city: input.city,
      currentDate: new Date().toISOString(),
      postText: post.text_content ?? undefined,
      sessionId: input.sessionId,
    });
    if (event && event.is_event) {
      extracted.push({ event, rawPostId: post.id });
      emit({ type: 'extracted', event, rawPostId: post.id });
    }
  }

  emit({ type: 'status', agent: 'dedup', message: 'Merging duplicate events across sources...' });
  await runDedup({
    candidates: extracted,
    city: input.city,
    recentHours: opts.dedupRecentHours,
    language: intent.language_filter === 'es' ? 'es' : 'en',
    sessionId: input.sessionId,
    onMerge: (merged, trace) => {
      emit({
        type: 'merged',
        canonical: merged,
        mergedFromCount: trace.mergedFromCount,
        trace: trace.steps,
      });
    },
  });

  emit({ type: 'status', agent: 'recommender', message: 'Ranking events for you...' });
  const ranked = await runRecommender({
    userPrefs: await fetchUserPrefs(input.sessionId),
    events: await fetchEventsForIntent(intent, input.city),
    sessionId: input.sessionId,
  });

  for (const r of ranked) {
    emit({
      type: 'recommendation',
      eventId: r.event_id,
      score: r.score,
      reasoning: r.reasoning,
    });
  }

  emit({
    type: 'final_result',
    eventIds: ranked.map(r => r.event_id),
  });
}

async function fetchUnprocessedEventPosts(city: string, limit: number) {
  const usedRawPostIds = await prisma.eventSource.findMany({ select: { raw_post_id: true } });
  const usedSet = new Set(usedRawPostIds.map(r => r.raw_post_id));

  const posts = await prisma.rawPost.findMany({
    where: {
      has_event_signal: true,
      source: { city_slug: city },
    },
    select: { id: true, text_content: true, image_urls: true, source_id: true },
    orderBy: { posted_at: 'desc' },
    take: Math.max(limit * 3, limit + 10),
  });

  return posts.filter(p => !usedSet.has(p.id)).slice(0, limit);
}

async function fetchUserPrefs(sessionId: string) {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { cause_prefs: true, action_prefs: true, neighborhood: true, language: true },
  });

  return {
    cause_prefs: (session?.cause_prefs ?? []) as ParsedIntent['cause_tags'],
    action_prefs: session?.action_prefs ?? ['attend'],
    neighborhood: session?.neighborhood ?? null,
    language: (session?.language ?? 'en') as 'en' | 'es',
  };
}

async function fetchEventsForIntent(intent: ParsedIntent, city: string) {
  const where: Parameters<typeof prisma.event.findMany>[0] extends infer P
    ? P extends { where?: infer W } ? W : never : never = {
    city_slug: city,
    status: 'upcoming',
  };

  if (intent.cause_tags.length > 0) where.cause_tags = { hasSome: intent.cause_tags };
  if (intent.event_types.length > 0) where.event_type = { in: intent.event_types };
  if (intent.date_range_start) where.datetime_iso = { ...(where.datetime_iso as object), gte: new Date(intent.date_range_start) };
  if (intent.date_range_end) where.datetime_iso = { ...(where.datetime_iso as object), lte: new Date(intent.date_range_end) };

  const rows = await prisma.event.findMany({
    where,
    select: {
      id: true, title: true, event_type: true, action_type: true,
      datetime_iso: true, location_text: true, organizer: true, cause_tags: true,
      lat: true, lng: true,
    },
    orderBy: { datetime_iso: 'asc' },
    take: 20,
  });

  return rows.map(e => ({
    id: e.id,
    title: e.title,
    event_type: e.event_type,
    action_type: e.action_type,
    datetime_iso: e.datetime_iso ? e.datetime_iso.toISOString() : null,
    location_text: e.location_text ?? '',
    organizer: e.organizer,
    cause_tags: e.cause_tags,
    distance_km: null,
  }));
}
