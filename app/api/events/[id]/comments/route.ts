import { prisma } from '@/lib/db';
import { requireVerifiedSession } from '@/lib/auth';
import { runSafetyReview } from '@/lib/agents/safetyReview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const eventId = params.id;
  if (!eventId) return Response.json({ error: 'event id required' }, { status: 400 });

  const rows = await prisma.eventComment.findMany({
    where: { event_id: eventId, status: 'approved' },
    orderBy: { created_at: 'desc' },
    take: 200,
    select: {
      id: true, body: true, created_at: true, session_id: true,
      session: { select: { display_name: true } },
    },
  });

  return Response.json({
    comments: rows.map(c => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at.toISOString(),
      author: c.session?.display_name ?? 'Anonymous',
      mine_session_id: c.session_id,
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const eventId = params.id;
  if (!eventId) return Response.json({ error: 'event id required' }, { status: 400 });

  const auth = await requireVerifiedSession(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  let body: { body?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  const text = (body.body ?? '').trim();
  if (text.length < 1 || text.length > 1000) {
    return Response.json({ error: 'comment body must be 1-1000 chars' }, { status: 400 });
  }

  // Make sure the event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, city_slug: true },
  });
  if (!event) return Response.json({ error: 'event not found' }, { status: 404 });

  // Run Safety Review on the body — same agent that gates flags. Errs to approve.
  const review = await runSafetyReview({
    flagType: 'other',
    note: text,
    city: (event.city_slug ?? 'nyc') as 'nyc' | 'guatemala_city',
    reporterSessionId: auth.session.id,
  });

  const status = review.decision === 'approve'
    ? 'approved'
    : review.decision === 'block' ? 'blocked' : 'review';

  const comment = await prisma.eventComment.create({
    data: {
      event_id: eventId,
      session_id: auth.session.id,
      body: review.redacted_note ?? text,
      status,
      safety_review_reasoning: review.reasoning,
    },
    select: {
      id: true, body: true, created_at: true,
      session: { select: { display_name: true } },
    },
  });

  return Response.json({
    comment: {
      id: comment.id,
      body: comment.body,
      created_at: comment.created_at.toISOString(),
      author: comment.session?.display_name ?? 'Anonymous',
    },
    review: { decision: review.decision, reasoning: review.reasoning },
  });
}
