// lib/agents/orchestrator.ts
// SSE-streaming orchestrator. Coordinates the full agent pipeline for a user
// prompt and emits live status events to the client for the AgentTrace UI.
//
// Usage from a route handler:
//
//   const stream = new ReadableStream({
//     async start(controller) {
//       const emit = (e: AgentEvent) =>
//         controller.enqueue(`data: ${JSON.stringify(e)}\n\n`);
//       try {
//         await orchestrate({ prompt, sessionId, city }, emit);
//       } catch (err) {
//         emit({ type: 'error', message: String(err) });
//       } finally {
//         emit({ type: 'done' });
//         controller.close();
//       }
//     }
//   });
//   return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });

import { parseIntent } from './intentParse';
import { runDiscovery } from './discovery';
import { runHarvester } from './harvester';
import { runVisionExtractor } from './visionExtractor';
import { runDedup } from './dedup';
import { runRecommender } from './recommender';
import { supabase } from '@/lib/supabase';
import type { ParsedIntent, ExtractedEvent, CanonicalEvent } from '@/lib/types';

// -----------------------------------------------------------------------------
// Event protocol — the shape of messages streamed to the client
// -----------------------------------------------------------------------------

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
    skipDiscovery?: boolean;     // demo: usually true (we have seeded sources)
    skipHarvest?: boolean;       // demo: usually true (we have seeded raw_posts)
    extractLimit?: number;       // cap vision calls per orchestration (default 8)
    dedupRecentHours?: number;   // dedup window (default 72)
  };
}

type Emit = (event: AgentEvent) => void;

// -----------------------------------------------------------------------------
// Main orchestrator
// -----------------------------------------------------------------------------

export async function orchestrate(input: OrchestrateInput, emit: Emit): Promise<void> {
  const opts = {
    skipDiscovery: input.options?.skipDiscovery ?? true,
    skipHarvest: input.options?.skipHarvest ?? true,
    extractLimit: input.options?.extractLimit ?? 8,
    dedupRecentHours: input.options?.dedupRecentHours ?? 72,
  };

  // 1. Parse intent
  emit({ type: 'status', agent: 'intent_parse', message: 'Parsing your request...' });
  const intent = await parseIntent({
    userMessage: input.prompt,
    city: input.city,
    sessionId: input.sessionId,
  });
  emit({ type: 'intent', intent });

  // 2. Discovery (optional — typically skipped in demo for speed)
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

  // 3. Harvest (optional — typically skipped in demo)
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

  // 4. Vision extraction on unprocessed raw_posts with event signal
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

  // 5. Dedup — embed candidates, find near-duplicates, judge with Opus
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

  // 6. Recommend — rank canonical events for user
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

// -----------------------------------------------------------------------------
// Supabase helpers
// -----------------------------------------------------------------------------

async function fetchUnprocessedEventPosts(city: string, limit: number) {
  const { data, error } = await supabase
    .from('raw_posts')
    .select('id, text_content, image_urls, source_id, sources!inner(city_slug)')
    .eq('has_event_signal', true)
    .eq('sources.city_slug', city)
    .not('id', 'in', supabase.from('event_sources').select('raw_post_id'))
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function fetchUserPrefs(sessionId: string) {
  const { data } = await supabase
    .from('user_sessions')
    .select('cause_prefs, action_prefs, neighborhood, language')
    .eq('id', sessionId)
    .single();

  return {
    cause_prefs: data?.cause_prefs ?? [],
    action_prefs: data?.action_prefs ?? ['attend'],
    neighborhood: data?.neighborhood ?? null,
    language: (data?.language ?? 'en') as 'en' | 'es',
  };
}

async function fetchEventsForIntent(intent: ParsedIntent, city: string) {
  let q = supabase
    .from('events')
    .select('id, title, event_type, action_type, datetime_iso, location_text, organizer, cause_tags, lat, lng')
    .eq('city_slug', city)
    .eq('status', 'upcoming');

  if (intent.cause_tags.length > 0) {
    q = q.overlaps('cause_tags', intent.cause_tags);
  }
  if (intent.event_types.length > 0) {
    q = q.in('event_type', intent.event_types);
  }
  if (intent.date_range_start) {
    q = q.gte('datetime_iso', intent.date_range_start);
  }
  if (intent.date_range_end) {
    q = q.lte('datetime_iso', intent.date_range_end);
  }

  const { data, error } = await q.order('datetime_iso').limit(20);
  if (error) throw error;

  return (data ?? []).map(e => ({
    ...e,
    distance_km: null, // computed downstream if neighborhood geocoded
  }));
}
