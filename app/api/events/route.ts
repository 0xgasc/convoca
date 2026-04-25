import { supabase } from '@/lib/supabase';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CITIES: CitySlug[] = ['nyc', 'guatemala_city'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get('city');
  const cause = url.searchParams.get('cause');
  const eventType = url.searchParams.get('type');
  const action = url.searchParams.get('action');
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');
  const status = url.searchParams.get('status') ?? 'upcoming';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);

  if (!city || !VALID_CITIES.includes(city as CitySlug)) {
    return Response.json({ error: 'city query param required (nyc | guatemala_city)' }, { status: 400 });
  }

  let q = supabase
    .from('events')
    .select('id, city_slug, title, event_type, action_type, datetime_iso, datetime_text_raw, end_datetime_iso, location_text, location_specificity, lat, lng, organizer, cause_tags, language, signup_url, status, extraction_confidence, created_at')
    .eq('city_slug', city)
    .eq('status', status)
    .order('datetime_iso', { ascending: true })
    .limit(limit);

  if (cause) q = q.contains('cause_tags', [cause]);
  if (eventType) q = q.eq('event_type', eventType);
  if (action) q = q.eq('action_type', action);
  if (dateFrom) q = q.gte('datetime_iso', dateFrom);
  if (dateTo) q = q.lte('datetime_iso', dateTo);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ events: data ?? [] });
}
