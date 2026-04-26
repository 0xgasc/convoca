import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_NAMES = [
  'orchestrator', 'intent_parse', 'discovery', 'harvester',
  'vision_extractor', 'dedup', 'recommender', 'safety_review',
];

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS agent_settings (
      agent_name TEXT PRIMARY KEY,
      context_prompt TEXT NOT NULL DEFAULT '',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      poll_interval_minutes INTEGER NOT NULL DEFAULT 30,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(req: Request) {
  if (!isAuthorizedAdmin(req)) return Response.json({ error: 'forbidden' }, { status: 403 });
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{
    agent_name: string;
    context_prompt: string;
    enabled: boolean;
    poll_interval_minutes: number;
    updated_at: string;
  }>>('SELECT * FROM agent_settings ORDER BY agent_name');

  // Fill in defaults for agents not yet in DB
  const byName = Object.fromEntries(rows.map(r => [r.agent_name, r]));
  const settings = AGENT_NAMES.map(name => byName[name] ?? {
    agent_name: name,
    context_prompt: '',
    enabled: true,
    poll_interval_minutes: 30,
    updated_at: new Date().toISOString(),
  });

  return Response.json({ settings });
}

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return Response.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json() as { agent_name: string; context_prompt?: string; enabled?: boolean; poll_interval_minutes?: number };
  if (!AGENT_NAMES.includes(body.agent_name)) {
    return Response.json({ error: 'unknown agent' }, { status: 400 });
  }
  await ensureTable();
  await prisma.$executeRawUnsafe(`
    INSERT INTO agent_settings (agent_name, context_prompt, enabled, poll_interval_minutes, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (agent_name) DO UPDATE SET
      context_prompt = EXCLUDED.context_prompt,
      enabled = EXCLUDED.enabled,
      poll_interval_minutes = EXCLUDED.poll_interval_minutes,
      updated_at = NOW()
  `, body.agent_name, body.context_prompt ?? '', body.enabled ?? true, body.poll_interval_minutes ?? 30);

  return Response.json({ ok: true });
}
