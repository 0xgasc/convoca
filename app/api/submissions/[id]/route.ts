import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) return Response.json({ error: 'not found' }, { status: 404 });

  return Response.json({
    submission: {
      ...sub,
      created_at: sub.created_at.toISOString(),
      processed_at: sub.processed_at?.toISOString() ?? null,
    },
  });
}
