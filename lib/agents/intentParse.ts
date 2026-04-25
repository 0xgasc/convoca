// lib/agents/intentParse.ts
// Turns a user's free-text prompt into structured filters that the rest of
// the pipeline can act on. Follows the same pattern as visionExtractor.ts.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { INTENT_PARSE_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { CAUSE_VOCABULARY, EVENT_TYPES } from '@/lib/constants';
import type { ParsedIntent, CitySlug } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ParsedIntentSchema = z.object({
  cause_tags: z.array(z.enum(CAUSE_VOCABULARY as unknown as [string, ...string[]])),
  event_types: z.array(z.enum(EVENT_TYPES as unknown as [string, ...string[]])),
  action_prefs: z.array(z.string()),
  date_range_start: z.string().nullable(),
  date_range_end: z.string().nullable(),
  neighborhood: z.string().nullable(),
  search_radius_km: z.number().nullable(),
  free_text_keywords: z.array(z.string()),
  language_filter: z.enum(['en', 'es', 'any']),
  reasoning: z.string(),
});

export interface ParseIntentInput {
  userMessage: string;
  city: CitySlug;
  sessionId: string;
  language?: 'en' | 'es';
}

export async function parseIntent(input: ParseIntentInput): Promise<ParsedIntent> {
  const startedAt = Date.now();
  const language = input.language ?? (input.city === 'guatemala_city' ? 'es' : 'en');

  const prompt = INTENT_PARSE_PROMPT({
    userMessage: input.userMessage,
    city: input.city,
    currentDate: new Date().toISOString(),
    language,
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);

  // Fallback intent if parsing fails — never return null, always something usable
  const fallback: ParsedIntent = {
    cause_tags: [],
    event_types: [],
    action_prefs: ['attend'],
    date_range_start: null,
    date_range_end: null,
    neighborhood: null,
    search_radius_km: null,
    free_text_keywords: input.userMessage.split(/\s+/).slice(0, 5),
    language_filter: 'any',
    reasoning: 'Could not parse intent — falling back to keyword search.',
  };

  if (!parsed) {
    await logAgentRun({
      sessionId: input.sessionId,
      agentName: 'intent_parse',
      inputSummary: input.userMessage.slice(0, 100),
      outputSummary: 'parse_failed',
      reasoningTrace: { rawResponse: rawText },
      durationMs: Date.now() - startedAt,
      model: 'claude-opus-4-7',
    });
    return fallback;
  }

  const validation = ParsedIntentSchema.safeParse(parsed);
  if (!validation.success) {
    await logAgentRun({
      sessionId: input.sessionId,
      agentName: 'intent_parse',
      inputSummary: input.userMessage.slice(0, 100),
      outputSummary: 'schema_validation_failed',
      reasoningTrace: { rawResponse: parsed, errors: validation.error.issues },
      durationMs: Date.now() - startedAt,
      model: 'claude-opus-4-7',
    });
    return fallback;
  }

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'intent_parse',
    inputSummary: input.userMessage.slice(0, 100),
    outputSummary: validation.data.reasoning,
    reasoningTrace: validation.data,
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  return validation.data as ParsedIntent;
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
