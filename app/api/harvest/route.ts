// app/api/harvest/route.ts
// Manual trigger for the harvester. Polls all due sources, runs the Haiku
// triage classifier, marks raw_posts with has_event_signal. Vision extraction
// runs separately when an orchestrator request comes in (or via /api/extract
// if added). Admin-gated to protect against abuse.

import { runHarvester } from '@/lib/agents/harvester';
import { isAuthorizedAdmin } from '@/lib/admin';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min ceiling for slow RSS feeds

export async function POST(req: Request) {
  // Three tiers of access:
  //   - cron secret header → no rate limit
  //   - admin key          → no rate limit
  //   - public anonymous   → strict rate limit (1 per IP per 2 min)
  const cronSecret = process.env.CRON_SECRET;
  const cronHeader = req.headers.get('x-cron-secret');
  const isCron = !!cronSecret && cronHeader === cronSecret;
  const isAdmin = isAuthorizedAdmin(req);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!isCron && !isAdmin) {
    const limit = rateLimit(`harvest:public:${ip}`, 1, 120);
    if (!limit.allowed) {
      return Response.json({
        error: 'Someone just refreshed sources. Try again shortly.',
        retry_after_sec: limit.retryAfterSec,
      }, { status: 429 });
    }
  } else {
    const limit = rateLimit(`harvest:priv:${ip}`, 6, 60);
    if (!limit.allowed) {
      return Response.json({ error: 'rate_limited', retry_after_sec: limit.retryAfterSec }, { status: 429 });
    }
  }

  let body: { city?: 'nyc' | 'guatemala_city'; sessionId?: string };
  try { body = await req.json(); } catch { body = {}; }

  const startedAt = Date.now();
  try {
    const result = await runHarvester({
      city: body.city,
      sessionId: body.sessionId ?? 'manual-harvest',
    });
    return Response.json({
      ...result,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - startedAt,
    }, { status: 500 });
  }
}
