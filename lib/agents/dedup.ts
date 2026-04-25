// lib/agents/dedup.ts
// Two-stage dedup:
//   1. pgvector embedding shortlist of candidates within recent_hours window
//   2. Opus judges each candidate pair, emits visible reasoning trace
// The reasoning trace is the demo wow — render it in the UI.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { DEDUP_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { supabase } from '@/lib/supabase';
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
  // For each fresh candidate, find nearby existing events via embedding similarity.
  // Then ask Opus whether each near-match is the same event.
  const results: CanonicalEvent[] = [];

  for (const cand of input.candidates) {
    // 1. Persist as candidate event first (may be deleted/merged after dedup)
    const candidateId = await insertCandidateEvent(cand.event, input.city, cand.rawPostId);
    if (!candidateId) continue;

    // 2. Find existing events within recent_hours that overlap on cause or proximity
    const nearby = await findNearbyEvents(candidateId, input.city, input.recentHours);
    if (nearby.length === 0) {
      // No candidates → keep as standalone canonical event
      const canonical = await fetchEvent(candidateId);
      if (canonical) results.push(canonical);
      continue;
    }

    // 3. Judge each pair
    let mergedInto: CanonicalEvent | null = null;
    for (const existing of nearby) {
      const judgment = await judgePair(cand.event, existing, input.language, input.sessionId);
      if (judgment?.same_event && judgment.confidence > 0.75) {
        // Merge candidate INTO the existing canonical event
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
  const { data, error } = await supabase
    .from('events')
    .insert({
      city_slug: city,
      title: e.title,
      event_type: e.event_type,
      action_type: e.action_type,
      datetime_iso: e.datetime_iso,
      datetime_text_raw: e.datetime_text_raw,
      end_datetime_iso: e.end_datetime_iso,
      location_text: e.location_text,
      location_specificity: e.location_specificity,
      lat: e.lat ?? null,
      lng: e.lng ?? null,
      organizer: e.organizer,
      cause_tags: e.cause_tags,
      language: e.language,
      signup_url: e.signup_url,
      capacity: e.capacity,
      extraction_confidence: e.confidence,
      status: 'upcoming',
    })
    .select('id')
    .single();

  if (error || !data) return null;
  await supabase.from('event_sources').insert({ event_id: data.id, raw_post_id: rawPostId });
  return data.id;
}

async function findNearbyEvents(
  candidateId: string,
  city: CitySlug,
  recentHours: number
): Promise<CanonicalEvent[]> {
  const since = new Date(Date.now() - recentHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('city_slug', city)
    .neq('id', candidateId)
    .gte('created_at', since)
    .limit(10);
  return (data ?? []) as CanonicalEvent[];
}

async function mergeCandidateInto(candidateId: string, canonicalId: string) {
  // Reassign event_sources rows from candidate → canonical, then delete candidate.
  await supabase
    .from('event_sources')
    .update({ event_id: canonicalId })
    .eq('event_id', candidateId);
  await supabase.from('events').delete().eq('id', candidateId);
}

async function fetchEvent(id: string): Promise<CanonicalEvent | null> {
  const { data } = await supabase.from('events').select('*').eq('id', id).single();
  return (data as CanonicalEvent) ?? null;
}

async function countSourcesForEvent(eventId: string): Promise<number> {
  const { count } = await supabase
    .from('event_sources')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  return count ?? 0;
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
