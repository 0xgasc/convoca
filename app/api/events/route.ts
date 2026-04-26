import { prisma } from '@/lib/db';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CITIES: CitySlug[] = [
  'nyc', 'guatemala_city',
] as CitySlug[];

const ALL_KNOWN_CITIES = new Set([
  'nyc', 'guatemala_city', 'los_angeles', 'san_francisco',
  'chicago', 'washington_dc', 'boston', 'seattle',
  'philadelphia', 'miami',
]);

// Approx bounding boxes for NYC boroughs (conservative). Used when borough
// filter is set: we filter events by lat/lng inside the box.
const BOROUGH_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  manhattan:     { minLat: 40.700, maxLat: 40.880, minLng: -74.020, maxLng: -73.910 },
  brooklyn:      { minLat: 40.570, maxLat: 40.740, minLng: -74.045, maxLng: -73.833 },
  queens:        { minLat: 40.540, maxLat: 40.820, minLng: -73.962, maxLng: -73.700 },
  bronx:         { minLat: 40.785, maxLat: 40.916, minLng: -73.933, maxLng: -73.750 },
  staten_island: { minLat: 40.477, maxLat: 40.651, minLng: -74.260, maxLng: -74.052 },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get('city');
  const causes = url.searchParams.getAll('cause');
  const eventTypes = url.searchParams.getAll('type');
  const actions = url.searchParams.getAll('action');
  const boroughs = url.searchParams.getAll('borough');
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');
  const status = url.searchParams.get('status') ?? 'upcoming';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);

  if (!city || !ALL_KNOWN_CITIES.has(city)) {
    return Response.json({ error: 'city query param required' }, { status: 400 });
  }

  const where: Record<string, unknown> = { city_slug: city, status };
  if (causes.length > 0) where.cause_tags = { hasSome: causes };
  if (eventTypes.length > 0) where.event_type = { in: eventTypes };
  if (actions.length > 0) where.action_type = { in: actions };
  if (dateFrom || dateTo) {
    where.datetime_iso = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (boroughs.length > 0) {
    // Build OR over the bbox of each requested borough
    const orClauses = boroughs
      .map(b => BOROUGH_BBOX[b])
      .filter(Boolean)
      .map(box => ({
        AND: [
          { lat: { gte: box.minLat } },
          { lat: { lte: box.maxLat } },
          { lng: { gte: box.minLng } },
          { lng: { lte: box.maxLng } },
        ],
      }));
    if (orClauses.length > 0) where.OR = orClauses;
  }

  try {
    const rows = await prisma.event.findMany({
      where,
      orderBy: { datetime_iso: 'asc' },
      take: limit,
      select: {
        id: true, city_slug: true, title: true, event_type: true, action_type: true,
        datetime_iso: true, datetime_text_raw: true, end_datetime_iso: true,
        location_text: true, location_specificity: true, lat: true, lng: true,
        organizer: true, cause_tags: true, language: true, signup_url: true,
        source_image_url: true, status: true, extraction_confidence: true, created_at: true,
      },
    });
    return Response.json({
      events: rows.map(serializeEvent),
      filters_applied: { causes, event_types: eventTypes, action_types: actions, boroughs },
      city,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

function serializeEvent(e: {
  id: string; city_slug: string | null; title: string; event_type: string; action_type: string;
  datetime_iso: Date | null; datetime_text_raw: string | null; end_datetime_iso: Date | null;
  location_text: string | null; location_specificity: string | null;
  lat: unknown; lng: unknown; organizer: string | null; cause_tags: string[]; language: string;
  signup_url: string | null; source_image_url: string | null; status: string;
  extraction_confidence: unknown; created_at: Date;
}) {
  return {
    ...e,
    datetime_iso: e.datetime_iso?.toISOString() ?? null,
    end_datetime_iso: e.end_datetime_iso?.toISOString() ?? null,
    lat: e.lat == null ? null : Number(e.lat),
    lng: e.lng == null ? null : Number(e.lng),
    extraction_confidence: e.extraction_confidence == null ? null : Number(e.extraction_confidence),
    created_at: e.created_at.toISOString(),
  };
}

// Silence unused-var warning while keeping the strict-list around for docs
void VALID_CITIES;
