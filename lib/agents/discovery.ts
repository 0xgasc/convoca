// lib/agents/discovery.ts
// Snowballs new civic-relevant accounts/feeds from existing seed sources.
// Lower priority for hackathon — orchestrator can skip this entirely with
// `options.skipDiscovery: true`. Implement after the core flow is shipping.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { DISCOVERY_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import type { CitySlug, CauseTag } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DiscoveryResultSchema = z.object({
  civic_relevance: z.number().min(0).max(1),
  source_type: z.array(z.string()),
  primary_causes: z.array(z.string()),
  language: z.enum(['en', 'es', 'mixed']),
  reasoning: z.string(),
  should_monitor: z.boolean(),
});

export interface DiscoveryInput {
  city: CitySlug;
  causeTags: CauseTag[];
  sessionId: string;
}

export interface DiscoveredSource {
  handle: string;
  civic_relevance: number;
  primary_causes: string[];
  reasoning: string;
}

export async function runDiscovery(input: DiscoveryInput): Promise<DiscoveredSource[]> {
  // For the hackathon MVP this returns an empty array unless implemented.
  // Real implementation would:
  //   1. Pull recent posts from existing active sources
  //   2. Extract mentioned/reposted/tagged accounts
  //   3. For each candidate, fetch bio + 5 recent posts (via the same ingest
  //      adapter as the source they were discovered from)
  //   4. Run DISCOVERY_PROMPT to score civic relevance
  //   5. Insert sources where should_monitor=true
  //
  // The reason this is a stub is that discovery requires platform-specific
  // fetching (Telegram channel scan, RSS link extraction, etc.) which is a
  // half-day of plumbing that doesn't directly serve the hackathon demo.
  //
  // For demo: trigger this manually via /api/discover with a hand-picked
  // candidate so judges see the agent reason about a real account.

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'discovery',
    inputSummary: `city=${input.city}, causes=${input.causeTags.join(',')}`,
    outputSummary: 'stub: returned 0 (hackathon MVP)',
    reasoningTrace: { note: 'Discovery agent is stubbed in hackathon MVP.' },
    durationMs: 0,
    model: 'none',
  });

  return [];
}

// Reference implementation for evaluating a single candidate (use in /api/discover)
export async function evaluateCandidate(input: {
  handle: string;
  bio: string;
  recentPosts: string[];
  discoveredVia: string;
  city: CitySlug;
  sessionId: string;
}): Promise<DiscoveredSource | null> {
  const startedAt = Date.now();

  const prompt = DISCOVERY_PROMPT({
    city: input.city,
    candidate: {
      handle: input.handle,
      bio: input.bio,
      recentPosts: input.recentPosts,
      discoveredVia: input.discoveredVia,
    },
  });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';
  const parsed = safeJsonParse(rawText);
  const validation = DiscoveryResultSchema.safeParse(parsed);

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'discovery',
    inputSummary: `evaluating ${input.handle}`,
    outputSummary: validation.success
      ? `relevance=${validation.data.civic_relevance.toFixed(2)} monitor=${validation.data.should_monitor}`
      : 'invalid_response',
    reasoningTrace: validation.success ? validation.data : { raw: parsed },
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  if (!validation.success || !validation.data.should_monitor) return null;

  return {
    handle: input.handle,
    civic_relevance: validation.data.civic_relevance,
    primary_causes: validation.data.primary_causes,
    reasoning: validation.data.reasoning,
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
