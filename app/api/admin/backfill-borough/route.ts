// POST /api/admin/backfill-borough
// Tags existing events with borough + neighborhood using two strategies:
//   1. Keyword matching against location_text
//   2. Lat/lng → BOROUGH_BBOX lookup (catches venue-only locations like "Carl Schurz Park")
// Processes all NYC events that have null borough. Safe to re-run.

import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/admin';
import { BOROUGH_KEYWORDS, BOROUGH_BBOX, NYC_NEIGHBORHOODS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KEYWORD_TO_BOROUGH: Array<{ keyword: string; borough: string }> = Object.entries(BOROUGH_KEYWORDS)
  .flatMap(([borough, keywords]) => keywords.map(kw => ({ keyword: kw, borough })))
  .sort((a, b) => b.keyword.length - a.keyword.length);

const NAME_TO_NEIGHBORHOOD: Array<{ name: string; slug: string; borough: string }> =
  Object.entries(NYC_NEIGHBORHOODS).flatMap(([borough, hoods]) =>
    hoods.map(h => ({ name: h.name.toLowerCase(), slug: h.slug, borough }))
  ).sort((a, b) => b.name.length - a.name.length);

function classifyByText(locationText: string | null): { borough: string | null; neighborhood: string | null } {
  if (!locationText) return { borough: null, neighborhood: null };
  const loc = locationText.toLowerCase();
  for (const { name, slug, borough } of NAME_TO_NEIGHBORHOOD) {
    if (loc.includes(name)) return { borough, neighborhood: slug };
  }
  for (const { keyword, borough } of KEYWORD_TO_BOROUGH) {
    if (loc.includes(keyword)) return { borough, neighborhood: null };
  }
  return { borough: null, neighborhood: null };
}

function classifyByLatLng(lat: number, lng: number): string | null {
  for (const [slug, bbox] of Object.entries(BOROUGH_BBOX)) {
    if (lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng) {
      return slug;
    }
  }
  return null;
}

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) return new Response('forbidden', { status: 403 });

  const startedAt = Date.now();

  const events = await prisma.$queryRawUnsafe<Array<{
    id: string;
    location_text: string | null;
    lat: string | null;
    lng: string | null;
  }>>(
    `SELECT id, location_text, lat::text, lng::text
     FROM events
     WHERE city_slug = 'nyc' AND borough IS NULL`
  );

  let tagged = 0;
  let withNeighborhood = 0;
  let via_latlng = 0;
  let unresolved = 0;

  for (const ev of events) {
    // Strategy 1: keyword match on location_text
    const textResult = classifyByText(ev.location_text);
    let borough = textResult.borough;
    const neighborhood = textResult.neighborhood;

    // Strategy 2: lat/lng → BOROUGH_BBOX
    if (!borough && ev.lat && ev.lng) {
      const lat = parseFloat(ev.lat);
      const lng = parseFloat(ev.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        borough = classifyByLatLng(lat, lng);
        if (borough) via_latlng++;
      }
    }

    if (borough) {
      await prisma.$executeRawUnsafe(
        `UPDATE events SET borough = $1, neighborhood = $2 WHERE id = $3::uuid`,
        borough, neighborhood, ev.id
      );
      tagged++;
      if (neighborhood) withNeighborhood++;
    } else {
      unresolved++;
    }
  }

  return Response.json({
    total_processed: events.length,
    tagged,
    via_latlng,
    with_neighborhood: withNeighborhood,
    unresolved,
    duration_ms: Date.now() - startedAt,
  });
}
