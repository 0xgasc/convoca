// lib/agents/safetyReview.ts
// Filters community-submitted safety flags before they appear publicly.
// Errs toward approval — real-time safety info is high-value to attendees.
// Blocks doxxing, hate speech, spam.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SAFETY_REVIEW_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { prisma } from '@/lib/db';
import type { CitySlug, FlagType, SafetyReviewResult } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const ReviewSchema = z.object({
  decision: z.enum(['approve', 'block', 'review']),
  reasoning: z.string(),
  redacted_note: z.string().nullable(),
});

export interface SafetyReviewInput {
  flagType: FlagType;
  note: string | null;
  city: CitySlug;
  reporterSessionId: string;
}

export async function runSafetyReview(input: SafetyReviewInput): Promise<SafetyReviewResult> {
  const startedAt = Date.now();

  const sessionAgeMinutes = await getSessionAgeMinutes(input.reporterSessionId);
  const recentFlagsCount = await countRecentFlagsBySession(input.reporterSessionId);

  const prompt = SAFETY_REVIEW_PROMPT({
    flagType: input.flagType,
    note: input.note,
    city: input.city,
    reporterSessionAgeMinutes: sessionAgeMinutes,
    similarFlagsFromSessionLastHour: recentFlagsCount,
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = ReviewSchema.safeParse(parsed);

  const result: SafetyReviewResult = validation.success
    ? validation.data
    : { decision: 'approve', reasoning: 'Review agent failed; defaulting to approve.', redacted_note: null };

  await logAgentRun({
    sessionId: input.reporterSessionId,
    agentName: 'safety_review',
    inputSummary: `${input.flagType} in ${input.city}`,
    outputSummary: `${result.decision}: ${result.reasoning.slice(0, 80)}`,
    reasoningTrace: result,
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  return result;
}

async function getSessionAgeMinutes(sessionId: string): Promise<number> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { created_at: true },
  });
  if (!session?.created_at) return 0;
  const age = Date.now() - session.created_at.getTime();
  return Math.floor(age / 60000);
}

async function countRecentFlagsBySession(sessionId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.eventFlag.count({
    where: {
      reporter_session_id: sessionId,
      created_at: { gte: since },
    },
  });
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
