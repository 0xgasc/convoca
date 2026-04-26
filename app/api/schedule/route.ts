// /api/schedule — runs the Scheduler agent over a session's saved events.

import { prisma } from '@/lib/db';
import { runScheduler } from '@/lib/agents/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  sessionId: string;
  query?: string;
  language?: 'en' | 'es';
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

  const saves = await prisma.eventSave.findMany({
    where: { session_id: body.sessionId },
    include: {
      event: {
        select: {
          id: true, title: true, event_type: true, action_type: true,
          datetime_iso: true, end_datetime_iso: true, location_text: true,
          lat: true, lng: true,
        },
      },
    },
  });

  const result = await runScheduler({
    userQuery: body.query?.trim() || (body.language === 'es' ? 'planeá mi semana' : 'plan my week'),
    language: body.language ?? 'en',
    savedEvents: saves.map(s => ({
      id: s.event.id,
      title: s.event.title,
      event_type: s.event.event_type,
      datetime_iso: s.event.datetime_iso?.toISOString() ?? null,
      end_datetime_iso: s.event.end_datetime_iso?.toISOString() ?? null,
      location_text: s.event.location_text,
      lat: s.event.lat == null ? null : Number(s.event.lat),
      lng: s.event.lng == null ? null : Number(s.event.lng),
      action_type: s.event.action_type,
    })),
    sessionId: body.sessionId,
  });

  return Response.json(result);
}
