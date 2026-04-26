// lib/agents/submissionAudit.ts
// Audits incoming submissions BEFORE they hit the vision extractor.
// Looks for state-actor sourcing, entrapment language, astroturf patterns.
// Cheap (Haiku) for the per-submission gate; result drives whether we proceed.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SUBMISSION_AUDIT_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { prisma } from '@/lib/db';
import type { CitySlug } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const AuditSchema = z.object({
  decision: z.enum(['process', 'review', 'reject']),
  trust_score: z.number().min(0).max(1),
  risk_signals: z.array(z.string()).default([]),
  reasoning: z.string(),
  redact_payload: z.boolean().default(false),
});

export type SubmissionAuditResult = z.infer<typeof AuditSchema>;

export interface SubmissionAuditInput {
  submissionType: 'image_upload' | 'url' | 'text';
  payloadSummary: string;
  city: CitySlug;
  reporterSessionId: string;
  language?: 'en' | 'es';
}

// Hard rules that don't need an LLM call — short-circuit before spending tokens
const HARD_REJECT_DOMAINS = [
  // Known LE/state coordination patterns. Add to this list over time.
  '.fbi.gov', 'dhs.gov', 'ice.gov', 'cbp.gov',
  // URL shorteners that hide destinations — review
];

const REVIEW_DOMAINS = [
  '.gov', '.mil',
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'rebrand.ly',
];

function quickScreen(payload: string, type: string): { decision: 'process' | 'review' | 'reject'; reason: string } | null {
  if (type !== 'url') return null;
  const lower = payload.toLowerCase();
  for (const d of HARD_REJECT_DOMAINS) {
    if (lower.includes(d)) {
      return { decision: 'reject', reason: `URL hosted on flagged law-enforcement domain (${d})` };
    }
  }
  for (const d of REVIEW_DOMAINS) {
    if (lower.includes(d)) {
      return { decision: 'review', reason: `URL hosted on ${d} — sending to human review` };
    }
  }
  return null;
}

export async function runSubmissionAudit(input: SubmissionAuditInput): Promise<SubmissionAuditResult> {
  const startedAt = Date.now();

  // 1. Hard-rule short circuit
  const quick = quickScreen(input.payloadSummary, input.submissionType);
  if (quick) {
    const result: SubmissionAuditResult = {
      decision: quick.decision,
      trust_score: quick.decision === 'reject' ? 0 : 0.3,
      risk_signals: ['domain_rule'],
      reasoning: quick.reason,
      redact_payload: false,
    };
    await logAgentRun({
      sessionId: input.reporterSessionId,
      agentName: 'submission_audit',
      inputSummary: `${input.submissionType}: ${input.payloadSummary.slice(0, 80)}`,
      outputSummary: `${result.decision} (rule: domain) — ${quick.reason.slice(0, 60)}`,
      reasoningTrace: result,
      durationMs: Date.now() - startedAt,
      model: 'rules',
    });
    return result;
  }

  // 2. Context for the LLM
  const sessionAgeMinutes = await getSessionAgeMinutes(input.reporterSessionId);
  const recentSubmissions = await countRecentSubmissionsBySession(input.reporterSessionId);

  const prompt = SUBMISSION_AUDIT_PROMPT({
    submissionType: input.submissionType,
    payloadSummary: input.payloadSummary,
    city: input.city,
    reporterSessionAgeMinutes: sessionAgeMinutes,
    reporterSubmissionsLastHour: recentSubmissions,
    language: input.language ?? 'en',
  });

  // Haiku — cheap per-submission gate
  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    // Fail-open: if the audit can't run, let the submission through but log it
    const result: SubmissionAuditResult = {
      decision: 'process',
      trust_score: 0.5,
      risk_signals: ['audit_unavailable'],
      reasoning: 'Audit agent unavailable; defaulted to process.',
      redact_payload: false,
    };
    await logAgentRun({
      sessionId: input.reporterSessionId,
      agentName: 'submission_audit',
      inputSummary: input.submissionType,
      outputSummary: `error: ${err instanceof Error ? err.message : String(err)}`,
      reasoningTrace: result,
      durationMs: Date.now() - startedAt,
      model: 'claude-haiku-4-5-20251001',
    });
    return result;
  }

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = AuditSchema.safeParse(parsed);

  const result: SubmissionAuditResult = validation.success ? validation.data : {
    decision: 'review',
    trust_score: 0.5,
    risk_signals: ['parse_failure'],
    reasoning: 'Audit response could not be parsed; routing to human review.',
    redact_payload: false,
  };

  await logAgentRun({
    sessionId: input.reporterSessionId,
    agentName: 'submission_audit',
    inputSummary: `${input.submissionType}: ${input.payloadSummary.slice(0, 80)}`,
    outputSummary: `${result.decision} (trust ${result.trust_score.toFixed(2)}) — ${result.risk_signals.join(',') || 'none'}`,
    reasoningTrace: result,
    durationMs: Date.now() - startedAt,
    model: 'claude-haiku-4-5-20251001',
  });

  return result;
}

async function getSessionAgeMinutes(sessionId: string): Promise<number> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { created_at: true },
  });
  if (!session?.created_at) return 0;
  return Math.floor((Date.now() - session.created_at.getTime()) / 60000);
}

async function countRecentSubmissionsBySession(sessionId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.submission.count({
    where: { submitted_by_session: sessionId, created_at: { gte: since } },
  });
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
