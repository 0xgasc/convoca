// /api/process-queue — runs the right extractor (vision or text) on N pending
// raw_posts that have has_event_signal=true and don't yet have an associated
// Event. Admin-gated.

import { prisma } from '@/lib/db';
import { runVisionExtractor, runTextExtractor } from '@/lib/agents/visionExtractor';
import { isAuthorizedAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  let body: { city?: 'nyc' | 'guatemala_city'; limit?: number };
  try { body = await req.json(); } catch { body = {}; }

  const limit = Math.min(body.limit ?? 25, 100);
  const startedAt = Date.now();

  const usedRawPostIds = await prisma.eventSource.findMany({ select: { raw_post_id: true } });
  const usedSet = new Set(usedRawPostIds.map(r => r.raw_post_id));

  const candidates = await prisma.rawPost.findMany({
    where: {
      has_event_signal: true,
      ...(body.city ? { source: { city_slug: body.city } } : {}),
    },
    select: {
      id: true, text_content: true, image_urls: true, url: true,
      source: { select: { city_slug: true } },
    },
    orderBy: { posted_at: 'desc' },
    take: Math.max(limit * 4, limit + 10),
  });

  const queue = candidates.filter(c => !usedSet.has(c.id)).slice(0, limit);

  let processed = 0;
  let createdEvents = 0;
  let skipped = 0;
  let viaVision = 0;
  let viaText = 0;

  const now = new Date().toISOString();
  for (const post of queue) {
    const city = (post.source?.city_slug ?? 'nyc') as 'nyc' | 'guatemala_city';
    const hasImage = post.image_urls.length > 0;
    const hasText = !!post.text_content && post.text_content.trim().length >= 10;

    if (!hasImage && !hasText) { skipped += 1; processed += 1; continue; }

    try {
      const event = hasImage
        ? await runVisionExtractor({
            imageUrl: post.image_urls[0],
            rawPostId: post.id,
            city,
            currentDate: now,
            postText: post.text_content ?? undefined,
            sessionId: 'admin-process-queue',
          })
        : await runTextExtractor({
            postText: post.text_content!,
            postUrl: post.url ?? undefined,
            rawPostId: post.id,
            city,
            currentDate: now,
            sessionId: 'admin-process-queue',
          });

      processed += 1;
      if (event && event.is_event) {
        createdEvents += 1;
        if (hasImage) viaVision += 1; else viaText += 1;
      }
    } catch (err) {
      console.error('[process-queue] extract failed', err);
      processed += 1;
    }
  }

  return Response.json({
    queue_size_before: queue.length,
    processed,
    created_events: createdEvents,
    via_vision: viaVision,
    via_text: viaText,
    skipped,
    duration_ms: Date.now() - startedAt,
  });
}

// GET: queue depth (text + image candidates) so the admin button isn't grey
export async function GET(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  const usedRawPostIds = await prisma.eventSource.findMany({ select: { raw_post_id: true } });
  const usedSet = new Set(usedRawPostIds.map(r => r.raw_post_id));

  const candidates = await prisma.rawPost.findMany({
    where: { has_event_signal: true },
    select: { id: true, image_urls: true, text_content: true },
  });
  const pending = candidates.filter(c => !usedSet.has(c.id));
  const withImages = pending.filter(p => p.image_urls.length > 0);
  const textOnly = pending.filter(p => p.image_urls.length === 0 && (p.text_content?.length ?? 0) >= 10);

  return Response.json({
    total_event_signal: candidates.length,
    pending_extraction: pending.length,
    pending_with_images: withImages.length,
    pending_text_only: textOnly.length,
    pending_processable: withImages.length + textOnly.length,
  });
}
