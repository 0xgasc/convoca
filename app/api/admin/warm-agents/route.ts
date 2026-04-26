// /api/admin/warm-agents — triggers one run of each agent that doesn't fire automatically.
// Intended for demo/onboarding: after running, all 7 agents will show in admin stats.
//
// Discovery: runs once with the seeded NYC context query.
// Safety Review: runs with a synthetic test flag (no DB write).
// Vision Extractor: handled by process-queue, but triggered here if there's a queued post.

import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';
import { runDiscovery } from '@/lib/agents/discovery';
import { runSafetyReview } from '@/lib/agents/safetyReview';
import { logAgentRun } from '@/lib/agents/traces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? req.headers.get('x-admin-key') ?? '';

  const results: Record<string, string> = {};

  // ── 1. Discovery ───────────────────────────────────────────────────────────
  try {
    const sources = await runDiscovery({
      city: 'nyc',
      sessionId: 'admin-warm',
      causeTags: ['housing', 'climate', 'immigration', 'mutual_aid', 'racial_justice'],
    });
    results.discovery = `Found ${sources.length} candidate sources`;
  } catch (err) {
    results.discovery = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ── 2. Safety Review ───────────────────────────────────────────────────────
  // Use a synthetic benign flag so it always approves and demonstrates the agent.
  try {
    const result = await runSafetyReview({
      flagType: 'medical_aid',
      note: 'First aid station available near the main stage entrance',
      city: 'nyc',
      reporterSessionId: 'admin-warm',
    });
    results.safety_review = `Decision: ${result.decision}`;
  } catch (err) {
    results.safety_review = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ── 3. Vision Extractor — trigger process-queue for any waiting posts ──────
  try {
    const waiting = await prisma.rawPost.count({
      where: { has_event_signal: true, is_in_scope: true },
    });

    if (waiting > 0) {
      // Call process-queue to handle them
      const pqUrl = new URL(req.url);
      pqUrl.pathname = '/api/process-queue';
      pqUrl.search = `?key=${encodeURIComponent(key)}&limit=3`;
      const pqRes = await fetch(pqUrl.toString(), { method: 'POST' });
      const pqJson = pqRes.ok ? await pqRes.json() as { processed?: number } : {};
      results.vision_extractor = `Processed ${pqJson.processed ?? 0} posts from queue (${waiting} waiting)`;
    } else {
      // Log a note — no raw posts available right now
      await logAgentRun({
        agentName: 'vision_extractor',
        sessionId: 'admin-warm',
        inputSummary: 'Admin warm-up check',
        outputSummary: 'No queued posts with images — run harvester first to populate the queue',
        durationMs: 0,
        reasoningTrace: null,
        model: 'none',
      });
      results.vision_extractor = 'No queued posts — harvest first';
    }
  } catch (err) {
    results.vision_extractor = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return Response.json({ ok: true, results });
}
