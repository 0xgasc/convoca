// lib/agents/traces.ts
// Persists every agent run for the live demo trace panel and basic observability.
// Used by all agents — the visible reasoning is the product, not debug output.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface AgentRunInput {
  sessionId: string;
  agentName: string;
  inputSummary: string;
  outputSummary: string;
  reasoningTrace: unknown;
  durationMs: number;
  model: string;
}

export async function logAgentRun(input: AgentRunInput): Promise<void> {
  try {
    await prisma.agentRun.create({
      data: {
        session_id: input.sessionId,
        agent_name: input.agentName,
        input_summary: input.inputSummary,
        output_summary: input.outputSummary,
        reasoning_trace: (input.reasoningTrace ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        duration_ms: input.durationMs,
        model: input.model,
      },
    });
  } catch (err) {
    console.error('[traces] failed to log agent run', err);
    // Never throw — trace logging failure must not break agent execution.
  }
}
