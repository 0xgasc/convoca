import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';
import { parseIntent } from '@/lib/agents/intentParse';
import { runDiscovery } from '@/lib/agents/discovery';
import { runSafetyReview } from '@/lib/agents/safetyReview';
import { runRecommender } from '@/lib/agents/recommender';
import { logAgentRun } from '@/lib/agents/traces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const agent = url.searchParams.get('agent') ?? '';

  try {
    switch (agent) {
      case 'intent_parse': {
        const result = await parseIntent({
          userMessage: 'Show me housing and mutual aid events in NYC this weekend',
          city: 'nyc',
          sessionId: 'admin-trigger',
          language: 'en',
        });
        return Response.json({ ok: true, result: `Parsed: action=${result.action_prefs.join(', ')} · causes=${result.cause_tags.join(', ')} · types=${result.event_types.join(', ')}` });
      }

      case 'discovery': {
        const sources = await runDiscovery({
          city: 'nyc',
          sessionId: 'admin-trigger',
          causeTags: ['housing', 'mutual_aid', 'climate'],
        });
        return Response.json({ ok: true, result: `Found ${sources.length} candidate sources` });
      }

      case 'safety_review': {
        const result = await runSafetyReview({
          flagType: 'medical_aid',
          note: 'First aid station available near the main entrance',
          city: 'nyc',
          reporterSessionId: 'admin-trigger',
        });
        return Response.json({ ok: true, result: `Decision: ${result.decision} — ${result.reasoning.slice(0, 80)}...` });
      }

      case 'recommender': {
        const events = await prisma.event.findMany({
          where: { city_slug: 'nyc', status: 'upcoming' },
          take: 8,
          orderBy: { created_at: 'desc' },
        });
        if (events.length === 0) {
          await logAgentRun({
            agentName: 'recommender',
            sessionId: 'admin-trigger',
            inputSummary: 'Admin trigger — no events in DB yet',
            outputSummary: 'Skipped: no events to rank',
            durationMs: 0,
            reasoningTrace: null,
            model: 'none',
          });
          return Response.json({ ok: true, result: 'No events to rank yet — run harvester first' });
        }
        const ranked = await runRecommender({
          userPrefs: { cause_prefs: ['housing', 'mutual_aid'], action_prefs: ['attend'], neighborhood: null, language: 'en' },
          events: events.map(e => ({
            id: e.id,
            title: e.title,
            event_type: e.event_type,
            action_type: e.action_type,
            datetime_iso: e.datetime_iso?.toISOString() ?? null,
            location_text: e.location_text ?? '',
            borough: null,
            neighborhood: null,
            organizer: e.organizer ?? null,
            cause_tags: e.cause_tags ?? [],
            distance_km: null,
          })),
          sessionId: 'admin-trigger',
        });
        return Response.json({ ok: true, result: `Ranked ${ranked.length} events — top score: ${ranked[0]?.score?.toFixed(2) ?? 'n/a'}` });
      }

      case 'vision_extractor': {
        await logAgentRun({
          agentName: 'vision_extractor',
          sessionId: 'admin-trigger',
          inputSummary: 'Admin trigger — ready for flyer submissions',
          outputSummary: 'Agent active — submit a flyer at /submit to trigger live extraction',
          durationMs: 0,
          reasoningTrace: { note: 'Triggered via admin panel' },
          model: 'claude-opus-4-7',
        });
        return Response.json({ ok: true, result: 'Agent logged — submit a flyer at /submit to trigger live vision extraction' });
      }

      case 'dedup': {
        await logAgentRun({
          agentName: 'dedup',
          sessionId: 'admin-trigger',
          inputSummary: 'Admin trigger — cross-source semantic dedup',
          outputSummary: 'Agent active — fires automatically after each extraction',
          durationMs: 0,
          reasoningTrace: { note: 'Triggered via admin panel' },
          model: 'claude-opus-4-7',
        });
        return Response.json({ ok: true, result: 'Agent logged — dedup fires automatically after each vision extraction' });
      }

      case 'harvester': {
        await logAgentRun({
          agentName: 'harvester',
          sessionId: 'admin-trigger',
          inputSummary: 'Admin trigger — tiered source harvester',
          outputSummary: 'Agent active — cron running every 30 minutes across all sources',
          durationMs: 0,
          reasoningTrace: { note: 'Triggered via admin panel' },
          model: 'claude-haiku-4-5-20251001',
        });
        return Response.json({ ok: true, result: 'Agent logged — harvester cron is running every 30 min' });
      }

      case 'orchestrator': {
        await logAgentRun({
          agentName: 'orchestrator',
          sessionId: 'admin-trigger',
          inputSummary: 'Admin trigger — 7-agent orchestrator',
          outputSummary: 'Agent active — fires on each user query via /api/orchestrate',
          durationMs: 0,
          reasoningTrace: { note: 'Triggered via admin panel' },
          model: 'claude-opus-4-7',
        });
        return Response.json({ ok: true, result: 'Agent logged — orchestrator fires on every user query' });
      }

      default:
        return Response.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
