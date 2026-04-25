import { prisma } from '@/lib/db';
import { runSafetyReview } from '@/lib/agents/safetyReview';
import { requireVerifiedSession } from '@/lib/auth';
import { FLAG_TYPE_DISPLAY } from '@/lib/constants';
import type { CitySlug, FlagSeverity, FlagType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CITIES: CitySlug[] = ['nyc', 'guatemala_city'];
const VALID_SEVERITIES: FlagSeverity[] = ['info', 'caution', 'urgent'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get('city');
  const flagType = url.searchParams.get('type');
  const since = url.searchParams.get('since');
  const bbox = url.searchParams.get('bbox');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);

  if (!city || !VALID_CITIES.includes(city as CitySlug)) {
    return Response.json({ error: 'city query param required (nyc | guatemala_city)' }, { status: 400 });
  }

  const where: Record<string, unknown> = {
    city_slug: city,
    status: 'approved',
    expires_at: { gt: new Date() },
  };
  if (flagType) where.flag_type = flagType;
  if (since) where.created_at = { gte: new Date(since) };
  if (bbox) {
    const parts = bbox.split(',').map(Number);
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      where.lng = { gte: minLng, lte: maxLng };
      where.lat = { gte: minLat, lte: maxLat };
    }
  }

  try {
    const rows = await prisma.eventFlag.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return Response.json({
      flags: rows.map(f => ({
        ...f,
        lat: Number(f.lat),
        lng: Number(f.lng),
        created_at: f.created_at.toISOString(),
        expires_at: f.expires_at.toISOString(),
      })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

interface PostBody {
  city: CitySlug;
  flag_type: FlagType;
  severity?: FlagSeverity;
  lat: number;
  lng: number;
  note?: string | null;
  event_id?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireVerifiedSession(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.city || !VALID_CITIES.includes(body.city)) {
    return Response.json({ error: 'invalid city' }, { status: 400 });
  }
  if (!body.flag_type || !FLAG_TYPE_DISPLAY[body.flag_type]) {
    return Response.json({ error: 'invalid flag_type' }, { status: 400 });
  }
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return Response.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const cityScope = FLAG_TYPE_DISPLAY[body.flag_type].applicable_cities;
  if (!cityScope.includes(body.city)) {
    return Response.json({
      error: `flag_type '${body.flag_type}' not applicable in ${body.city}`,
    }, { status: 400 });
  }

  const severity: FlagSeverity = body.severity && VALID_SEVERITIES.includes(body.severity)
    ? body.severity
    : 'caution';

  const review = await runSafetyReview({
    flagType: body.flag_type,
    note: body.note ?? null,
    city: body.city,
    reporterSessionId: auth.session.id,
  });

  const ttlMinutes = FLAG_TYPE_DISPLAY[body.flag_type].default_ttl_minutes;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const noteToStore = review.redacted_note ?? body.note ?? null;

  try {
    const flag = await prisma.eventFlag.create({
      data: {
        event_id: body.event_id ?? null,
        city_slug: body.city,
        flag_type: body.flag_type,
        severity,
        lat: body.lat,
        lng: body.lng,
        note: noteToStore,
        reporter_session_id: auth.session.id,
        status: review.decision === 'approve' ? 'approved' : review.decision === 'block' ? 'blocked' : 'review',
        safety_review_reasoning: review.reasoning,
        expires_at: expiresAt,
      },
    });

    return Response.json({
      flag: {
        ...flag,
        lat: Number(flag.lat),
        lng: Number(flag.lng),
        created_at: flag.created_at.toISOString(),
        expires_at: flag.expires_at.toISOString(),
      },
      review: { decision: review.decision, reasoning: review.reasoning },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
