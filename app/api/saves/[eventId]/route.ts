// /api/saves/[eventId] — delete a save (un-save).

import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { eventId: string } }) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId') ?? req.headers.get('x-session-id');
  if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

  try {
    await prisma.eventSave.delete({
      where: { session_id_event_id: { session_id: sessionId, event_id: params.eventId } },
    });
    return Response.json({ ok: true });
  } catch {
    // Already gone is fine
    return Response.json({ ok: true });
  }
}
