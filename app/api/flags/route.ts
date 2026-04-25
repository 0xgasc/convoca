import { supabase } from '@/lib/supabase';
import { runSafetyReview } from '@/lib/agents/safetyReview';
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

  let q = supabase
    .from('event_flags')
    .select('id, event_id, city_slug, flag_type, severity, lat, lng, note, confirmation_count, status, created_at, expires_at')
    .eq('city_slug', city)
    .eq('status', 'approved')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (flagType) q = q.eq('flag_type', flagType);
  if (since) q = q.gte('created_at', since);
  if (bbox) {
    const parts = bbox.split(',').map(Number);
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      q = q.gte('lng', minLng).lte('lng', maxLng).gte('lat', minLat).lte('lat', maxLat);
    }
  }

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ flags: data ?? [] });
}

interface PostBody {
  city: CitySlug;
  flag_type: FlagType;
  severity?: FlagSeverity;
  lat: number;
  lng: number;
  note?: string | null;
  event_id?: string | null;
  reporter_session_id: string;
}

export async function POST(req: Request) {
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
  if (!body.reporter_session_id) {
    return Response.json({ error: 'reporter_session_id required' }, { status: 400 });
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
    reporterSessionId: body.reporter_session_id,
  });

  const ttlMinutes = FLAG_TYPE_DISPLAY[body.flag_type].default_ttl_minutes;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const noteToStore = review.redacted_note ?? body.note ?? null;

  const { data, error } = await supabase
    .from('event_flags')
    .insert({
      event_id: body.event_id ?? null,
      city_slug: body.city,
      flag_type: body.flag_type,
      severity,
      lat: body.lat,
      lng: body.lng,
      note: noteToStore,
      reporter_session_id: body.reporter_session_id,
      status: review.decision === 'approve' ? 'approved' : review.decision === 'block' ? 'blocked' : 'review',
      safety_review_reasoning: review.reasoning,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    flag: data,
    review: { decision: review.decision, reasoning: review.reasoning },
  });
}
