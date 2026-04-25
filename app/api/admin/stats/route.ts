import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    eventsByCity,
    sources,
    flags,
    sessions,
    sessions24h,
    runs24h,
    runsByAgent,
    avgLatencyByAgent,
    submissionsByStatus,
    pendingSubmissions,
    recentEvents,
    flagsByStatus,
  ] = await Promise.all([
    prisma.event.groupBy({ by: ['city_slug'], _count: { _all: true } }),
    prisma.source.count(),
    prisma.eventFlag.count({ where: { status: 'approved', expires_at: { gt: new Date() } } }),
    prisma.userSession.count(),
    prisma.userSession.count({ where: { created_at: { gte: since24h } } }),
    prisma.agentRun.count({ where: { created_at: { gte: since24h } } }),
    prisma.agentRun.groupBy({
      by: ['agent_name'],
      where: { created_at: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.agentRun.groupBy({
      by: ['agent_name'],
      where: { created_at: { gte: since7d }, duration_ms: { not: null } },
      _avg: { duration_ms: true },
    }),
    prisma.submission.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.submission.count({ where: { status: { in: ['pending', 'processing'] } } }),
    prisma.event.count({ where: { created_at: { gte: since24h } } }),
    prisma.eventFlag.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return Response.json({
    generated_at: new Date().toISOString(),
    events: {
      total: eventsByCity.reduce((s, r) => s + r._count._all, 0),
      by_city: Object.fromEntries(eventsByCity.map(r => [r.city_slug ?? 'unknown', r._count._all])),
      created_last_24h: recentEvents,
    },
    sources: { total: sources },
    flags: {
      live: flags,
      by_status: Object.fromEntries(flagsByStatus.map(r => [r.status, r._count._all])),
    },
    sessions: { total: sessions, new_last_24h: sessions24h },
    submissions: {
      pending_or_processing: pendingSubmissions,
      by_status: Object.fromEntries(submissionsByStatus.map(r => [r.status, r._count._all])),
    },
    agents: {
      runs_last_24h: runs24h,
      runs_by_agent_7d: Object.fromEntries(runsByAgent.map(r => [r.agent_name, r._count._all])),
      avg_latency_ms_7d: Object.fromEntries(avgLatencyByAgent.map(r => [r.agent_name, Math.round(r._avg.duration_ms ?? 0)])),
    },
  });
}
