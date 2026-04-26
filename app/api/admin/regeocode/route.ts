import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BBOX_STR: Record<string, string> = {
  nyc: '-74.26,40.48,-73.68,40.93',
  guatemala_city: '-90.65,14.45,-90.40,14.75',
};
const PROXIMITY: Record<string, string> = {
  nyc: '-74.0060,40.7128',
  guatemala_city: '-90.5069,14.6349',
};
const COUNTRY: Record<string, string> = { nyc: 'us', guatemala_city: 'gt' };
const BOROUGH_LABEL: Record<string, string> = {
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  queens: 'Queens',
  bronx: 'Bronx',
  staten_island: 'Staten Island',
};

async function geocodeQuery(query: string, city: string): Promise<{ lat: number; lng: number } | null> {
  if (!process.env.MAPBOX_TOKEN) return null;
  const bboxStr = BBOX_STR[city] ?? BBOX_STR.nyc;
  const params = new URLSearchParams({
    proximity: PROXIMITY[city] ?? PROXIMITY.nyc,
    bbox: bboxStr,
    country: COUNTRY[city] ?? 'us',
    types: 'poi,address,neighborhood,locality,place',
    limit: '1',
    access_token: process.env.MAPBOX_TOKEN,
  });
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
    );
    if (!res.ok) return null;
    const json = await res.json() as { features?: Array<{ center: [number, number]; relevance?: number }> };
    const feature = json?.features?.[0];
    if (!feature?.center) return null;
    if ((feature.relevance ?? 1) < 0.3) return null;
    const [minLng, minLat, maxLng, maxLat] = bboxStr.split(',').map(Number);
    const [lng, lat] = feature.center;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null;
    return { lng, lat };
  } catch { return null; }
}

async function geocode(locationText: string, borough: string | null, city: string): Promise<{ lat: number; lng: number } | null> {
  const normalized = locationText.replace(/\s*:\s*/g, ', ');
  const hasNYCHint = /new york|nyc|\bny\b/i.test(normalized);
  const boroughHint = borough ? `, ${BOROUGH_LABEL[borough] ?? ''}` : '';
  const cityHint = city === 'nyc' ? ', New York City, NY' : ', Ciudad de Guatemala';
  const fullQuery = hasNYCHint ? normalized : `${normalized}${boroughHint}${cityHint}`;

  // Try full query first
  const result = await geocodeQuery(fullQuery, city);
  if (result) return result;

  // Fallback 1: if there's a sub-venue prefix ("Cop Cot, Central Park" → "Central Park")
  const commaIdx = normalized.indexOf(',');
  if (commaIdx > 0) {
    const simpler = normalized.slice(commaIdx + 1).trim();
    const simplerQuery = hasNYCHint ? simpler : `${simpler}${boroughHint}${cityHint}`;
    const result2 = await geocodeQuery(simplerQuery, city);
    if (result2) return result2;
  }

  // Fallback 2: just borough centroid hint with city (last resort — keeps pin in right borough)
  if (borough) {
    const boroughQuery = `${BOROUGH_LABEL[borough]}, New York City, NY`;
    return geocodeQuery(boroughQuery, city);
  }

  return null;
}

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json() as { city?: string; limit?: number };
  const city = body.city ?? 'nyc';
  const limit = Math.min(body.limit ?? 300, 500);
  const started = Date.now();

  const events = await prisma.$queryRawUnsafe<Array<{
    id: string;
    location_text: string | null;
    borough: string | null;
    city_slug: string;
  }>>(
    `SELECT id, location_text, borough, city_slug
     FROM events
     WHERE city_slug = $1
       AND location_text IS NOT NULL
       AND location_text != ''
     ORDER BY created_at DESC
     LIMIT $2`,
    city, limit
  );

  let fixed = 0;
  let failed = 0;

  for (const ev of events) {
    const result = await geocode(ev.location_text!, ev.borough, ev.city_slug);
    if (!result) { failed++; continue; }

    await prisma.$executeRawUnsafe(
      `UPDATE events SET lat = $1, lng = $2 WHERE id = $3::uuid`,
      result.lat, result.lng, ev.id
    );
    fixed++;
  }

  return Response.json({
    total: events.length,
    fixed,
    skipped: events.length - fixed - failed,
    failed,
    duration_ms: Date.now() - started,
  });
}
