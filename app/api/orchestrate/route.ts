// app/api/orchestrate/route.ts
// SSE streaming endpoint. Takes a user prompt, runs the full agent pipeline,
// streams status events to the client for the live AgentTrace UI.

import { orchestrate, type AgentEvent } from '@/lib/agents/orchestrator';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrchestrateBody {
  prompt: string;
  sessionId: string;
  city: CitySlug;
  options?: {
    skipDiscovery?: boolean;
    skipHarvest?: boolean;
    extractLimit?: number;
    dedupRecentHours?: number;
  };
}

export async function POST(req: Request) {
  let body: OrchestrateBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.prompt || !body.sessionId || !body.city) {
    return new Response('Missing required fields: prompt, sessionId, city', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed (client disconnected)
        }
      };

      try {
        await orchestrate(
          {
            prompt: body.prompt,
            sessionId: body.sessionId,
            city: body.city,
            options: body.options,
          },
          emit,
        );
      } catch (err) {
        emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        emit({ type: 'done' });
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
