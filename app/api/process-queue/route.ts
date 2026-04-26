// /api/process-queue — runs vision_extractor on N pending raw_posts that have
// has_event_signal=true and don't yet have an associated Event. Admin-gated.
// Each successful extraction creates an Event (and event_sources row).

import { prisma } from '@/lib/db';
import { runVisionExtractor } from '@/lib/agents/visionExtractor';
import { isAuthorizedAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  let body: { city?: 'nyc' | 'guatemala_city'; limit?: number };
  try { body = await req.json(); } catch { body = {}; }

  const limit = Math.min(body.limit ?? 6, 20);
  const startedAt = Date.now();

  // Find raw_posts that look like events but haven't been turned into an Event yet
  const usedRawPostIds = await prisma.eventSource.findMany({ select: { raw_post_id: true } });
  const usedSet = new Set(usedRawPostIds.map(r => r.raw_post_id));

  const candidates = await prisma.rawPost.findMany({
    where: {
      has_event_signal: true,
      ...(body.city ? { source: { city_slug: body.city } } : {}),
    },
    select: {
      id: true, text_content: true, image_urls: true,
      source: { select: { city_slug: true } },
    },
    orderBy: { posted_at: 'desc' },
    take: Math.max(limit * 4, limit + 10),
  });

  const queue = candidates.filter(c => !usedSet.has(c.id)).slice(0, limit);

  let processed = 0;
  let createdEvents = 0;
  let skipped = 0;

  for (const post of queue) {
    if (post.image_urls.length === 0) {
      // Text-only path is not yet implemented for harvested posts — skip
      skipped += 1;
      processed += 1;
      continue;
    }
    try {
      const event = await runVisionExtractor({
        imageUrl: post.image_urls[0],
        rawPostId: post.id,
        city: (post.source?.city_slug ?? 'nyc') as 'nyc' | 'guatemala_city',
        currentDate: new Date().toISOString(),
        postText: post.text_content ?? undefined,
        sessionId: 'admin-process-queue',
      });
      processed += 1;
      if (event && event.is_event) createdEvents += 1;
    } catch (err) {
      console.error('[process-queue] vision failed', err);
      processed += 1;
    }
  }

  return Response.json({
    queue_size_before: queue.length,
    processed,
    created_events: createdEvents,
    skipped,
    duration_ms: Date.now() - startedAt,
  });
}

// GET: just return queue depth so admin can show it without processing
export async function GET(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  const usedRawPostIds = await prisma.eventSource.findMany({ select: { raw_post_id: true } });
  const usedSet = new Set(usedRawPostIds.map(r => r.raw_post_id));
  const total = await prisma.rawPost.count({ where: { has_event_signal: true } });
  const candidates = await prisma.rawPost.findMany({
    where: { has_event_signal: true },
    select: { id: true, image_urls: true },
  });
  const pending = candidates.filter(c => !usedSet.has(c.id));
  const withImages = pending.filter(p => p.image_urls.length > 0);

  return Response.json({
    total_event_signal: total,
    pending_extraction: pending.length,
    pending_with_images: withImages.length,
  });
}
