// lib/agents/recommender.ts
// Ranks events for a user with one-sentence reasoning per item.
// The reasoning is shown directly to the user — write it like a human would.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { RECOMMENDER_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import type { RankedEvent, CauseTag } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const RankedSchema = z.object({
  ranked: z.array(z.object({
    event_id: z.string(),
    score: z.number().min(0).max(1),
    reasoning: z.string(),
  })),
});

export interface RecommenderInput {
  userPrefs: {
    cause_prefs: CauseTag[];
    action_prefs: string[];
    neighborhood: string | null;
    language: 'en' | 'es';
  };
  events: Array<{
    id: string;
    title: string;
    event_type: string;
    action_type: string;
    datetime_iso: string | null;
    location_text: string;
    organizer: string | null;
    cause_tags: string[];
    distance_km: number | null;
  }>;
  sessionId: string;
}

export async function runRecommender(input: RecommenderInput): Promise<RankedEvent[]> {
  if (input.events.length === 0) return [];

  const startedAt = Date.now();

  const prompt = RECOMMENDER_PROMPT({
    userPrefs: input.userPrefs,
    events: input.events.map(e => ({
      id: e.id,
      title: e.title,
      event_type: e.event_type,
      action_type: e.action_type,
      datetime_iso: e.datetime_iso ?? '',
      location_text: e.location_text,
      organizer: e.organizer ?? '',
      cause_tags: e.cause_tags,
      distance_km: e.distance_km,
    })),
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = RankedSchema.safeParse(parsed);

  if (!validation.success) {
    // Fallback: rank by date, no reasoning
    const fallback: RankedEvent[] = input.events.map(e => ({
      event_id: e.id,
      score: 0.5,
      reasoning: input.userPrefs.language === 'es' ? 'Próximo en tu ciudad.' : 'Coming up in your city.',
    }));
    await logAgentRun({
      sessionId: input.sessionId,
      agentName: 'recommender',
      inputSummary: `${input.events.length} events`,
      outputSummary: 'fallback_used',
      reasoningTrace: { rawResponse: parsed },
      durationMs: Date.now() - startedAt,
      model: 'claude-opus-4-7',
    });
    return fallback;
  }

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'recommender',
    inputSummary: `${input.events.length} events`,
    outputSummary: `ranked top: ${validation.data.ranked[0]?.event_id ?? 'none'}`,
    reasoningTrace: validation.data,
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  return validation.data.ranked;
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
