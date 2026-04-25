import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '60', 10), 200);
  const agent = url.searchParams.get('agent');

  const runs = await prisma.agentRun.findMany({
    where: agent ? { agent_name: agent } : undefined,
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return Response.json({
    runs: runs.map(r => ({
      ...r,
      created_at: r.created_at.toISOString(),
    })),
  });
}
