// /api/curate — runs the Curator agent for a session over upcoming events.

import { prisma } from '@/lib/db';
import { runCurator } from '@/lib/agents/curator';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CITIES: CitySlug[] = ['nyc', 'guatemala_city'];

interface Body {
  sessionId: string;
  city: CitySlug;
  language?: 'en' | 'es';
  maxResults?: number;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  if (!body.sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
  if (!body.city || !VALID_CITIES.includes(body.city)) {
    return Response.json({ error: 'invalid city' }, { status: 400 });
  }

  const [session, saves, passes, candidates] = await Promise.all([
    prisma.userSession.findUnique({
      where: { id: body.sessionId },
      select: { cause_prefs: true, action_prefs: true, neighborhood: true, language: true },
    }),
    prisma.eventSave.findMany({
      where: { session_id: body.sessionId },
      include: { event: { select: { id: true, title: true } } },
    }),
    prisma.eventPass.findMany({
      where: { session_id: body.sessionId },
      include: { event: { select: { id: true, title: true } } },
    }),
    prisma.event.findMany({
      where: {
        city_slug: body.city,
        status: 'upcoming',
        OR: [
          { datetime_iso: null },
          { datetime_iso: { gte: new Date() } },
        ],
      },
      select: {
        id: true, title: true, event_type: true, action_type: true,
        datetime_iso: true, location_text: true, organizer: true, cause_tags: true,
        lat: true, lng: true,
      },
      orderBy: { datetime_iso: 'asc' },
      take: 80,
    }),
  ]);

  // Exclude events the user already saved or passed
  const seen = new Set<string>([
    ...saves.map(s => s.event_id),
    ...passes.map(p => p.event_id),
  ]);
  const fresh = candidates.filter(c => !seen.has(c.id));

  const result = await runCurator({
    language: body.language ?? (session?.language as 'en' | 'es' | undefined) ?? 'en',
    userPrefs: {
      cause_prefs: session?.cause_prefs ?? [],
      action_prefs: session?.action_prefs ?? ['attend'],
      neighborhood: session?.neighborhood ?? null,
      language: (session?.language ?? 'en') as 'en' | 'es',
    },
    savedTitles: saves.map(s => s.event.title),
    passedTitles: passes.map(p => p.event.title),
    candidates: fresh.map(e => ({
      id: e.id,
      title: e.title,
      event_type: e.event_type,
      action_type: e.action_type,
      datetime_iso: e.datetime_iso?.toISOString() ?? null,
      location_text: e.location_text,
      organizer: e.organizer,
      cause_tags: e.cause_tags,
      distance_km: null,
    })),
    maxResults: body.maxResults ?? 12,
    sessionId: body.sessionId,
  });

  // Hydrate the curated entries with full event data so the UI can render them
  const eventById = new Map(fresh.map(e => [e.id, e]));
  const curated = result.curated.map(c => {
    const ev = eventById.get(c.event_id);
    if (!ev) return null;
    return {
      ...c,
      event: {
        ...ev,
        datetime_iso: ev.datetime_iso?.toISOString() ?? null,
        lat: ev.lat == null ? null : Number(ev.lat),
        lng: ev.lng == null ? null : Number(ev.lng),
      },
    };
  }).filter(Boolean);

  return Response.json({
    curated,
    skipped_summary: result.skipped_summary,
    candidate_count: fresh.length,
  });
}
