import { prisma } from '@/lib/db';
import { runVisionExtractor, runTextExtractor } from '@/lib/agents/visionExtractor';
import type { ExtractedEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json() as { sessionId?: string; context?: string };
  const { sessionId, context } = body;
  if (!sessionId || !context?.trim()) {
    return Response.json({ error: 'Missing sessionId or context' }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({ where: { id: params.id } });
  if (!submission) return Response.json({ error: 'Not found' }, { status: 404 });
  if (submission.submitted_by_session !== sessionId) {
    return Response.json({ error: 'Not your submission' }, { status: 403 });
  }
  if (submission.status !== 'rejected') {
    return Response.json({ error: 'Can only appeal rejected submissions' }, { status: 400 });
  }

  const city = (submission.city_slug ?? 'nyc') as 'nyc' | 'guatemala_city';
  const now = new Date().toISOString();
  const userContext = context.trim().slice(0, 500);

  let event: ExtractedEvent | null = null;

  if (submission.submission_type === 'text') {
    event = await runTextExtractor({
      postText: `[Submitter context: ${userContext}]\n\n${submission.payload}`,
      city,
      currentDate: now,
      sessionId,
    });
  } else {
    // 'url' or 'image_upload' — payload is always a URL (Stash/Arweave or direct)
    event = await runVisionExtractor({
      imageUrl: submission.payload,
      postText: `Submitter context: ${userContext}`,
      city,
      currentDate: now,
      sessionId,
    });
  }

  if (!event || !event.is_event) {
    await prisma.submission.update({
      where: { id: params.id },
      data: {
        rejection_reason: `Appeal reviewed — AI still could not confirm as a civic event. Your context: "${userContext.slice(0, 120)}"`,
      },
    });
    return Response.json({
      status: 'rejected',
      message: 'The agent reviewed your context but still could not confirm this as a civic event. Try adding more details about the organizer, location, or what action attendees will take.',
    });
  }

  const inserted = await prisma.event.create({
    data: {
      city_slug: city,
      title: event.title,
      event_type: event.event_type,
      action_type: event.action_type,
      datetime_iso: event.datetime_iso ? new Date(event.datetime_iso) : null,
      datetime_text_raw: event.datetime_text_raw,
      end_datetime_iso: event.end_datetime_iso ? new Date(event.end_datetime_iso) : null,
      location_text: event.location_text,
      location_specificity: event.location_specificity,
      lat: (event as ExtractedEvent & { lat?: number }).lat ?? null,
      lng: (event as ExtractedEvent & { lng?: number }).lng ?? null,
      borough: event.borough ?? null,
      neighborhood: event.neighborhood ?? null,
      organizer: event.organizer,
      cause_tags: event.cause_tags,
      language: event.language,
      signup_url: event.signup_url,
      source_image_url: submission.submission_type !== 'text' ? submission.payload : null,
      extraction_confidence: event.confidence,
      status: 'upcoming',
    },
    select: { id: true },
  });

  await prisma.submission.update({
    where: { id: params.id },
    data: {
      status: 'approved',
      result_event_id: inserted.id,
      processed_at: new Date(),
      rejection_reason: null,
    },
  });

  return Response.json({ status: 'approved', event_id: inserted.id });
}
