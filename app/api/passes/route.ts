// /api/passes — record a "not for me" or "maybe later" decision so Curator
// doesn't keep suggesting it.

import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  sessionId: string;
  eventId: string;
  decision: 'pass' | 'maybe';
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.sessionId || !body.eventId) {
    return Response.json({ error: 'sessionId and eventId required' }, { status: 400 });
  }
  const decision = body.decision === 'maybe' ? 'maybe' : 'pass';

  await prisma.userSession.upsert({
    where: { id: body.sessionId },
    create: { id: body.sessionId },
    update: {},
  });

  const ev = await prisma.event.findUnique({ where: { id: body.eventId }, select: { id: true } });
  if (!ev) return Response.json({ error: 'event not found' }, { status: 404 });

  const pass = await prisma.eventPass.upsert({
    where: { session_id_event_id: { session_id: body.sessionId, event_id: body.eventId } },
    create: { session_id: body.sessionId, event_id: body.eventId, decision },
    update: { decision },
  });

  return Response.json({
    pass: {
      session_id: pass.session_id,
      event_id: pass.event_id,
      decision: pass.decision,
      created_at: pass.created_at.toISOString(),
    },
  });
}
