// lib/agents/scheduler.ts
// Modular agent: takes a user constraint + saved events, returns an itinerary
// with chronological order, travel buffers, and conflict notes.
//
// Callable independently from /api/schedule, or wired into the orchestrator
// when a chat prompt looks schedule-y ("plan my Saturday", "build a day").

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SCHEDULER_PROMPT } from './prompts';
import { logAgentRun } from './traces';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ScheduleSchema = z.object({
  summary: z.string(),
  itinerary: z.array(z.object({
    event_id: z.string(),
    order: z.number(),
    arrival_time_local: z.string(),
    leave_time_local: z.string(),
    travel_to_next_min: z.number().nullable().optional(),
    reasoning: z.string(),
  })),
  conflicts: z.array(z.object({
    event_ids: z.array(z.string()),
    reason: z.string(),
  })).default([]),
  skipped: z.array(z.object({
    event_id: z.string(),
    reason: z.string(),
  })).default([]),
});

export type ScheduleResult = z.infer<typeof ScheduleSchema>;

export interface SchedulerInput {
  userQuery: string;
  language: 'en' | 'es';
  savedEvents: Array<{
    id: string;
    title: string;
    event_type: string;
    datetime_iso: string | null;
    end_datetime_iso: string | null;
    location_text: string | null;
    lat: number | null;
    lng: number | null;
    action_type: string;
  }>;
  sessionId: string;
}

export async function runScheduler(input: SchedulerInput): Promise<ScheduleResult> {
  const startedAt = Date.now();

  if (input.savedEvents.length === 0) {
    const empty: ScheduleResult = {
      summary: input.language === 'es'
        ? 'Aún no has guardado eventos. Guardá algunos y volvé.'
        : "You haven't saved any events yet. Save some and come back.",
      itinerary: [], conflicts: [], skipped: [],
    };
    return empty;
  }

  const prompt = SCHEDULER_PROMPT({
    userQuery: input.userQuery,
    language: input.language,
    currentDate: new Date().toISOString(),
    savedEvents: input.savedEvents,
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = ScheduleSchema.safeParse(parsed);

  const result: ScheduleResult = validation.success ? validation.data : {
    summary: input.language === 'es'
      ? 'No pude planificar tu día. Intentá ser más específico.'
      : "I couldn't plan your day. Try being more specific.",
    itinerary: [], conflicts: [], skipped: [],
  };

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'scheduler',
    inputSummary: input.userQuery.slice(0, 100),
    outputSummary: validation.success
      ? `${result.itinerary.length} events, ${result.conflicts.length} conflicts`
      : 'invalid_response',
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
