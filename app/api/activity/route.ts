import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ActivityItem {
  id: string;
  kind: 'harvest' | 'extract' | 'dedup' | 'ask' | 'new_event' | 'recommend' | 'safety' | 'agent';
  agent: string;
  headline: string;
  detail: string | null;
  event_id: string | null;
  created_at: string;
}

function formatRun(r: {
  id: string;
  agent_name: string;
  input_summary: string | null;
  output_summary: string | null;
  created_at: Date;
  duration_ms: number | null;
}): ActivityItem {
  const agent = r.agent_name;
  const input = r.input_summary ?? '';
  const output = r.output_summary ?? '';

  let kind: ActivityItem['kind'] = 'agent';
  let headline = '';
  let detail: string | null = null;

  switch (agent) {
    case 'harvester': {
      kind = 'harvest';
      const mPosts = output.match(/(\d+)\s+posts?/i);
      const mSrc = output.match(/(\d+)\s+sources?/i);
      const nPosts = mPosts ? mPosts[1] : null;
      const nSrc = mSrc ? mSrc[1] : null;
      if (nPosts && nSrc) {
        headline = `Swept ${nSrc} sources · ${nPosts} new posts spotted`;
      } else if (nPosts) {
        headline = `Swept civic sources · ${nPosts} new posts worth a look`;
      } else {
        headline = 'Swept civic sources — checking for new activity';
      }
      detail = null;
      break;
    }
    case 'vision_extractor':
    case 'text_extractor': {
      kind = 'extract';
      if (output && output !== 'not_an_event' && output !== 'schema_validation_failed') {
        // output is "Title — event_type — conf 0.91"
        const titlePart = output.split(' — ')[0];
        headline = `Read a flyer · pulled out: ${titlePart}`;
      } else {
        headline = 'Scanned a post — no civic event found';
      }
      detail = null;
      break;
    }
    case 'dedup': {
      kind = 'dedup';
      const mMerge = output.match(/merged\s+(\d+)/i);
      if (mMerge) {
        headline = `${mMerge[1]} duplicate posts → merged into one clean event`;
      } else if (output.includes('no duplicate') || output.includes('unique')) {
        headline = 'Verified unique — no duplicate found across sources';
      } else {
        headline = output || 'Cross-checked for duplicate events';
      }
      detail = null;
      break;
    }
    case 'orchestrator': {
      kind = 'ask';
      const nEv = output.match(/(\d+)\s+event/i)?.[1] ?? '?';
      headline = `Found ${nEv} events for: "${input.slice(0, 60)}"`;
      detail = null;
      break;
    }
    case 'recommender': {
      kind = 'recommend';
      headline = output || 'Ranked events by relevance to your query';
      detail = null;
      break;
    }
    case 'safety_review': {
      kind = 'safety';
      headline = output || 'Reviewed a community safety flag';
      detail = null;
      break;
    }
    case 'submission_audit': {
      kind = 'safety';
      if (output && output.includes('approved')) {
        headline = 'Community submission passed safety check';
      } else if (output && output.includes('reject')) {
        headline = 'Submission flagged — did not meet community standards';
      } else {
        headline = 'Audited a community submission';
      }
      detail = null;
      break;
    }
    default: {
      kind = 'agent';
      headline = output || input || agent;
      detail = null;
    }
  }

  return {
    id: r.id,
    kind,
    agent,
    headline,
    detail,
    event_id: null,
    created_at: r.created_at.toISOString(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get('city') ?? 'nyc';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '40', 10), 100);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const [runs, newEvents] = await Promise.all([
    prisma.agentRun.findMany({
      where: { created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true, agent_name: true,
        input_summary: true, output_summary: true,
        created_at: true, duration_ms: true,
      },
    }),
    prisma.event.findMany({
      where: { city_slug: city, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: 30,
      select: { id: true, title: true, location_text: true, event_type: true, created_at: true },
    }),
  ]);

  const NOISE = ['schema_validation_failed', 'not_an_event', 'not_civic', 'error'];
  const runItems: ActivityItem[] = runs
    .map(formatRun)
    .filter(item => {
      if (item.kind === 'agent') return false; // generic fallthrough — not useful to users
      if (NOISE.some(n => item.headline.toLowerCase().includes(n))) return false;
      return true;
    });

  const eventItems: ActivityItem[] = newEvents.map(e => ({
    id: `ev_${e.id}`,
    kind: 'new_event' as const,
    agent: 'pipeline',
    headline: e.title,
    detail: e.location_text ?? null,
    event_id: e.id,
    created_at: e.created_at.toISOString(),
  }));

  // Merge and sort
  const all = [...runItems, ...eventItems].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return Response.json({ items: all.slice(0, limit) });
}
