import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  let sessionId = '';
  try {
    const body = await req.json();
    sessionId = String(body.sessionId ?? '');
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

  const existing = await prisma.eventFlag.findUnique({
    where: { id },
    select: { id: true, confirmation_count: true, reporter_session_id: true },
  });
  if (!existing) return Response.json({ error: 'not found' }, { status: 404 });
  if (existing.reporter_session_id === sessionId) {
    return Response.json({ error: 'cannot confirm own flag' }, { status: 400 });
  }

  const updated = await prisma.eventFlag.update({
    where: { id },
    data: { confirmation_count: { increment: 1 } },
    select: { id: true, confirmation_count: true },
  });

  return Response.json({ flag: updated });
}
