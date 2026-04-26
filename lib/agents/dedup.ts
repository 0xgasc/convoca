// lib/agents/dedup.ts
// Two-stage dedup:
//   1. Recent-window candidate shortlist (city + recent_hours)
//   2. Opus judges each candidate pair, emits visible reasoning trace
// The reasoning trace is the demo wow — render it in the UI.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { DEDUP_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { prisma } from '@/lib/db';
import type { CanonicalEvent, ExtractedEvent, CitySlug } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DedupResultSchema = z.object({
  same_event: z.boolean(),
  confidence: z.number().min(0).max(1),
  merge_strategy: z.enum(['use_a', 'use_b', 'merge_fields']).nullable(),
  field_recommendations: z.object({
    title: z.string(),
    location_text: z.string(),
    organizer: z.string(),
  }).optional(),
  reasoning_trace: z.array(z.string()),
});

export interface DedupInput {
  candidates: Array<{ event: ExtractedEvent; rawPostId: string }>;
  city: CitySlug;
  recentHours: number;
  language: 'en' | 'es';
  sessionId: string;
  onMerge?: (
    canonical: CanonicalEvent,
    info: { mergedFromCount: number; steps: string[] }
  ) => void;
}

export async function runDedup(input: DedupInput): Promise<CanonicalEvent[]> {
  const results: CanonicalEvent[] = [];

  for (const cand of input.candidates) {
    const candidateId = await insertCandidateEvent(cand.event, input.city, cand.rawPostId);
    if (!candidateId) continue;

    const nearby = await findNearbyEvents(candidateId, input.city, input.recentHours);
    if (nearby.length === 0) {
      const canonical = await fetchEvent(candidateId);
      if (canonical) results.push(canonical);
      continue;
    }

    let mergedInto: CanonicalEvent | null = null;
    for (const existing of nearby) {
      const judgment = await judgePair(cand.event, existing, input.language, input.sessionId);
      if (judgment?.same_event && judgment.confidence > 0.75) {
        await mergeCandidateInto(candidateId, existing.id);
        mergedInto = existing;
        if (input.onMerge) {
          const sourceCount = await countSourcesForEvent(existing.id);
          input.onMerge(existing, {
            mergedFromCount: sourceCount,
            steps: judgment.reasoning_trace,
          });
        }
        break;
      }
    }

    if (!mergedInto) {
      const canonical = await fetchEvent(candidateId);
      if (canonical) results.push(canonical);
    }
  }

  return results;
}

async function judgePair(
  a: ExtractedEvent,
  b: CanonicalEvent,
  language: 'en' | 'es',
  sessionId: string
) {
  const startedAt = Date.now();

  const prompt = DEDUP_PROMPT({
    eventA: stripForPrompt(a),
    eventB: stripForPrompt(b),
    language,
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = DedupResultSchema.safeParse(parsed);

  await logAgentRun({
    sessionId,
    agentName: 'dedup',
    inputSummary: `${a.title} vs ${b.title}`,
    outputSummary: validation.success
      ? `same_event=${validation.data.same_event} (${validation.data.confidence.toFixed(2)})`
      : 'invalid_response',
    reasoningTrace: validation.success ? validation.data : { raw: parsed },
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  return validation.success ? validation.data : null;
}

function stripForPrompt(e: ExtractedEvent | CanonicalEvent) {
  return {
    title: e.title,
    event_type: e.event_type,
    datetime_iso: e.datetime_iso,
    location_text: e.location_text,
    organizer: e.organizer,
    cause_tags: e.cause_tags,
    lat: 'lat' in e ? e.lat : null,
    lng: 'lng' in e ? e.lng : null,
  };
}

async function insertCandidateEvent(
  e: ExtractedEvent,
  city: CitySlug,
  rawPostId: string
): Promise<string | null> {
  try {
    const inserted = await prisma.event.create({
      data: {
        city_slug: city,
        title: e.title,
        event_type: e.event_type,
        action_type: e.action_type,
        datetime_iso: e.datetime_iso ? new Date(e.datetime_iso) : null,
        datetime_text_raw: e.datetime_text_raw,
        end_datetime_iso: e.end_datetime_iso ? new Date(e.end_datetime_iso) : null,
        location_text: e.location_text,
        location_specificity: e.location_specificity,
        lat: e.lat ?? null,
        lng: e.lng ?? null,
        borough: e.borough ?? null,
        neighborhood: e.neighborhood ?? null,
        organizer: e.organizer,
        cause_tags: e.cause_tags,
        language: e.language,
        signup_url: e.signup_url,
        source_image_url: e.source_image_url ?? null,
        capacity: e.capacity,
        extraction_confidence: e.confidence,
        status: 'upcoming',
      },
      select: { id: true },
    });
    await prisma.eventSource.create({
      data: { event_id: inserted.id, raw_post_id: rawPostId },
    });
    return inserted.id;
  } catch (err) {
    console.error('[dedup] insertCandidate failed', err);
    return null;
  }
}

async function findNearbyEvents(
  candidateId: string,
  city: CitySlug,
  recentHours: number
): Promise<CanonicalEvent[]> {
  const candidate = await prisma.event.findUnique({ where: { id: candidateId } });
  const since = new Date(Date.now() - recentHours * 60 * 60 * 1000);

  // Build datetime window: ±3 days around the candidate's event datetime (if known)
  const datetimeFilter = candidate?.datetime_iso ? (() => {
    const dt = candidate.datetime_iso!;
    const window = 3 * 24 * 60 * 60 * 1000;
    return { gte: new Date(dt.getTime() - window), lte: new Date(dt.getTime() + window) };
  })() : undefined;

  const rows = await prisma.event.findMany({
    where: {
      city_slug: city,
      created_at: { gte: since },
      NOT: { id: candidateId },
      ...(datetimeFilter ? { datetime_iso: datetimeFilter } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: 8,
  });
  return rows.map(rowToCanonical);
}

async function mergeCandidateInto(candidateId: string, canonicalId: string) {
  await prisma.eventSource.updateMany({
    where: { event_id: candidateId },
    data: { event_id: canonicalId },
  });
  await prisma.event.delete({ where: { id: candidateId } });
}

async function fetchEvent(id: string): Promise<CanonicalEvent | null> {
  const row = await prisma.event.findUnique({ where: { id } });
  return row ? rowToCanonical(row) : null;
}

async function countSourcesForEvent(eventId: string): Promise<number> {
  return prisma.eventSource.count({ where: { event_id: eventId } });
}

function rowToCanonical(row: {
  id: string; city_slug: string | null; title: string; event_type: string; action_type: string;
  datetime_iso: Date | null; datetime_text_raw: string | null; end_datetime_iso: Date | null;
  location_text: string | null; location_specificity: string | null;
  lat: unknown; lng: unknown; borough?: string | null; neighborhood?: string | null;
  organizer: string | null; cause_tags: string[]; language: string;
  signup_url: string | null; capacity: number | null; signup_deadline: Date | null;
  status: string; extraction_confidence: unknown; created_at: Date;
}): CanonicalEvent {
  return {
    id: row.id,
    city_slug: (row.city_slug ?? 'nyc') as CanonicalEvent['city_slug'],
    title: row.title,
    event_type: row.event_type as CanonicalEvent['event_type'],
    action_type: row.action_type as CanonicalEvent['action_type'],
    datetime_iso: row.datetime_iso ? row.datetime_iso.toISOString() : null,
    datetime_text_raw: row.datetime_text_raw ?? '',
    end_datetime_iso: row.end_datetime_iso ? row.end_datetime_iso.toISOString() : null,
    location_text: row.location_text ?? '',
    location_specificity: (row.location_specificity ?? 'vague') as CanonicalEvent['location_specificity'],
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    borough: row.borough ?? null,
    neighborhood: row.neighborhood ?? null,
    organizer: row.organizer,
    cause_tags: row.cause_tags as CanonicalEvent['cause_tags'],
    language: row.language as CanonicalEvent['language'],
    signup_url: row.signup_url,
    capacity: row.capacity,
    signup_deadline: row.signup_deadline ? row.signup_deadline.toISOString() : null,
    status: row.status as CanonicalEvent['status'],
    extraction_confidence: row.extraction_confidence == null ? null : Number(row.extraction_confidence),
    created_at: row.created_at.toISOString(),
  };
}

function safeJsonParse(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}
