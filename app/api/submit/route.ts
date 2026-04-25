// app/api/submit/route.ts
// Community submission endpoint. No image persistence — flyer bytes go straight
// to the vision agent in-memory. URL/text submissions are processed inline.

import { prisma } from '@/lib/db';
import { runVisionExtractor } from '@/lib/agents/visionExtractor';
import { rateLimit } from '@/lib/rateLimit';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ImageMedia = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

function pickMediaType(contentType: string): ImageMedia {
  if (contentType.includes('png')) return 'image/png';
  if (contentType.includes('webp')) return 'image/webp';
  if (contentType.includes('gif')) return 'image/gif';
  return 'image/jpeg';
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  let submissionType: 'image_upload' | 'url' | 'text';
  let payload: string;
  let sessionId: string;
  let city: CitySlug;
  let imageBuffer: Buffer | undefined;
  let imageMediaType: ImageMedia | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    sessionId = String(form.get('sessionId') ?? '');
    city = (form.get('city') as CitySlug) ?? 'nyc';

    if (!file) return badRequest('Missing image file');
    submissionType = 'image_upload';
    imageBuffer = Buffer.from(await file.arrayBuffer());
    imageMediaType = pickMediaType(file.type);
    payload = `inline:${file.name}:${imageBuffer.length}b`;
  } else {
    const body = await req.json();
    sessionId = String(body.sessionId ?? '');
    city = (body.city as CitySlug) ?? 'nyc';

    if (body.url) {
      submissionType = 'url';
      payload = String(body.url);
    } else if (body.text) {
      submissionType = 'text';
      payload = String(body.text);
    } else {
      return badRequest('Provide one of: image (multipart), url, or text');
    }
  }

  if (!sessionId) return badRequest('Missing sessionId');

  // Bot / spam guard: 10 submissions per session per hour, 30 per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const sessionLimit = rateLimit(`submit:s:${sessionId}`, 10, 3600);
  const ipLimit = rateLimit(`submit:ip:${ip}`, 30, 3600);
  if (!sessionLimit.allowed || !ipLimit.allowed) {
    const retry = Math.max(sessionLimit.retryAfterSec, ipLimit.retryAfterSec);
    return new Response(
      JSON.stringify({ error: 'Too many submissions. Slow down.', retry_after_sec: retry }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retry) } },
    );
  }

  const submission = await prisma.submission.create({
    data: {
      city_slug: city,
      submitted_by_session: sessionId,
      submission_type: submissionType,
      payload,
      status: 'pending',
    },
    select: { id: true },
  });

  void processSubmission({
    submissionId: submission.id,
    submissionType,
    payload,
    city,
    sessionId,
    imageBuffer,
    imageMediaType,
  });

  return Response.json({
    submissionId: submission.id,
    status: 'pending',
    message: 'Submission received. Processing...',
  });
}

interface ProcessInput {
  submissionId: string;
  submissionType: 'image_upload' | 'url' | 'text';
  payload: string;
  city: CitySlug;
  sessionId: string;
  imageBuffer?: Buffer;
  imageMediaType?: ImageMedia;
}

async function processSubmission(input: ProcessInput): Promise<void> {
  try {
    await prisma.submission.update({
      where: { id: input.submissionId },
      data: { status: 'processing' },
    });

    const imageBuffer: Buffer | undefined = input.imageBuffer;
    const imageMediaType: ImageMedia | undefined = input.imageMediaType;
    let imageUrl: string | undefined;
    let postText: string | undefined;
    let sourceImageUrl: string | undefined;

    if (input.submissionType === 'url') {
      const meta = await fetchUrlMetadata(input.payload);
      imageUrl = meta.imageUrl ?? undefined;
      sourceImageUrl = imageUrl ?? input.payload;
      postText = meta.text;
    } else if (input.submissionType === 'text') {
      postText = input.payload;
    }

    if (!imageBuffer && !imageUrl && !postText) {
      await prisma.submission.update({
        where: { id: input.submissionId },
        data: { status: 'rejected', rejection_reason: 'No usable content extracted', processed_at: new Date() },
      });
      return;
    }

    if (imageBuffer || imageUrl) {
      const event = await runVisionExtractor({
        imageBuffer,
        imageMediaType,
        imageUrl,
        sourceImageUrl,
        rawPostId: undefined,
        city: input.city,
        currentDate: new Date().toISOString(),
        postText,
        sessionId: input.sessionId,
      });

      if (!event || !event.is_event) {
        await prisma.submission.update({
          where: { id: input.submissionId },
          data: { status: 'rejected', rejection_reason: 'Not identified as a civic event', processed_at: new Date() },
        });
        return;
      }

      const inserted = await prisma.event.create({
        data: {
          city_slug: input.city,
          title: event.title,
          event_type: event.event_type,
          action_type: event.action_type,
          datetime_iso: event.datetime_iso ? new Date(event.datetime_iso) : null,
          datetime_text_raw: event.datetime_text_raw,
          location_text: event.location_text,
          location_specificity: event.location_specificity,
          lat: event.lat ?? null,
          lng: event.lng ?? null,
          organizer: event.organizer,
          cause_tags: event.cause_tags,
          language: event.language,
          signup_url: event.signup_url,
          source_image_url: sourceImageUrl ?? null,
          extraction_confidence: event.confidence,
          status: 'upcoming',
        },
        select: { id: true },
      });

      await prisma.submission.update({
        where: { id: input.submissionId },
        data: {
          status: 'approved',
          result_event_id: inserted.id,
          processed_at: new Date(),
        },
      });
    } else {
      await prisma.submission.update({
        where: { id: input.submissionId },
        data: { status: 'rejected', rejection_reason: 'Text-only submissions not yet supported', processed_at: new Date() },
      });
    }
  } catch (err) {
    console.error('[submit] processing failed', err);
    await prisma.submission.update({
      where: { id: input.submissionId },
      data: { status: 'rejected', rejection_reason: String(err), processed_at: new Date() },
    });
  }
}

async function fetchUrlMetadata(url: string): Promise<{ imageUrl: string | null; text: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Convoca/0.1 (+https://convoca.app)' } });
    if (!res.ok) return { imageUrl: null, text: '' };
    const html = await res.text();
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ?? '';
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ?? '';
    return { imageUrl: ogImage, text: `${ogTitle}\n\n${ogDesc}` };
  } catch {
    return { imageUrl: null, text: '' };
  }
}

function badRequest(msg: string) {
  return new Response(msg, { status: 400 });
}
