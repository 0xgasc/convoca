// lib/agents/curator.ts
// Curator agent — pre-fills a user's watchlist based on their causes,
// neighborhood, prior saves, and prior passes. Different from Recommender:
// Recommender answers a single chat query; Curator builds a personalized
// batch the user can accept/reject.
//
// Modular: callable from /api/curate. The decisions the user makes (save vs
// pass) feed back as positive/negative signals on the next curation.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { CURATOR_PROMPT } from './prompts';
import { logAgentRun } from './traces';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const CuratedSchema = z.object({
  curated: z.array(z.object({
    event_id: z.string(),
    score: z.number().min(0).max(1),
    why: z.string(),
  })),
  skipped_summary: z.string().default(''),
});

export type CuratedResult = z.infer<typeof CuratedSchema>;

export interface CuratorInput {
  language: 'en' | 'es';
  userPrefs: {
    cause_prefs: string[];
    action_prefs: string[];
    neighborhood: string | null;
    language: 'en' | 'es';
  };
  savedTitles: string[];
  passedTitles: string[];
  candidates: Array<{
    id: string;
    title: string;
    event_type: string;
    action_type: string;
    datetime_iso: string | null;
    location_text: string | null;
    organizer: string | null;
    cause_tags: string[];
    distance_km: number | null;
  }>;
  maxResults?: number;
  sessionId: string;
}

export async function runCurator(input: CuratorInput): Promise<CuratedResult> {
  const startedAt = Date.now();

  if (input.candidates.length === 0) {
    const empty: CuratedResult = { curated: [], skipped_summary: 'no candidate events available' };
    return empty;
  }

  const prompt = CURATOR_PROMPT({
    language: input.language,
    currentDate: new Date().toISOString(),
    userPrefs: input.userPrefs,
    savedTitles: input.savedTitles,
    passedTitles: input.passedTitles,
    candidates: input.candidates,
    maxResults: input.maxResults ?? 12,
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = CuratedSchema.safeParse(parsed);

  const result: CuratedResult = validation.success ? validation.data : {
    curated: input.candidates.slice(0, input.maxResults ?? 12).map(c => ({
      event_id: c.id, score: 0.5,
      why: input.language === 'es' ? 'Coincide con tus preferencias.' : 'Matches your preferences.',
    })),
    skipped_summary: 'fallback — agent response could not be parsed',
  };

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'curator',
    inputSummary: `prefs: ${input.userPrefs.cause_prefs.join(',')} · ${input.candidates.length} candidates`,
    outputSummary: `${result.curated.length} curated · ${result.skipped_summary.slice(0, 80)}`,
    reasoningTrace: validation.success ? result : { raw: parsed },
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  return result;
}

function safeJsonParse(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); }
  catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}
