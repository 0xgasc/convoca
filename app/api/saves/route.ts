// /api/saves — list / create event saves for a session.

import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['saved', 'rsvp', 'maybe']);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

  const rows = await prisma.eventSave.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'desc' },
    include: {
      event: {
        select: {
          id: true, title: true, event_type: true, action_type: true,
          datetime_iso: true, datetime_text_raw: true, end_datetime_iso: true,
          location_text: true, lat: true, lng: true,
          organizer: true, cause_tags: true, language: true,
          signup_url: true, status: true, city_slug: true,
        },
      },
    },
  });

  return Response.json({
    saves: rows.map(r => ({
      session_id: r.session_id,
      event_id: r.event_id,
      status: r.status,
      note: r.note,
      created_at: r.created_at.toISOString(),
      event: {
        ...r.event,
        datetime_iso: r.event.datetime_iso?.toISOString() ?? null,
        end_datetime_iso: r.event.end_datetime_iso?.toISOString() ?? null,
        lat: r.event.lat == null ? null : Number(r.event.lat),
        lng: r.event.lng == null ? null : Number(r.event.lng),
      },
    })),
  });
}

interface PostBody {
  sessionId: string;
  eventId: string;
  status?: 'saved' | 'rsvp' | 'maybe';
  note?: string | null;
}

export async function POST(req: Request) {
  let body: PostBody;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  if (!body.sessionId || !body.eventId) {
    return Response.json({ error: 'sessionId and eventId required' }, { status: 400 });
  }
  const status = body.status && VALID_STATUSES.has(body.status) ? body.status : 'saved';

  // Make sure session row exists (orchestrator usually creates it; for new visitors who haven't onboarded, upsert here).
  await prisma.userSession.upsert({
    where: { id: body.sessionId },
    create: { id: body.sessionId },
    update: {},
  });

  // Make sure the event exists
  const ev = await prisma.event.findUnique({ where: { id: body.eventId }, select: { id: true } });
  if (!ev) return Response.json({ error: 'event not found' }, { status: 404 });

  const save = await prisma.eventSave.upsert({
    where: { session_id_event_id: { session_id: body.sessionId, event_id: body.eventId } },
    create: { session_id: body.sessionId, event_id: body.eventId, status, note: body.note ?? null },
    update: { status, note: body.note ?? undefined },
  });

  return Response.json({
    save: {
      session_id: save.session_id,
      event_id: save.event_id,
      status: save.status,
      note: save.note,
      created_at: save.created_at.toISOString(),
    },
  });
}
