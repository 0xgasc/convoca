import { prisma } from '@/lib/db';
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

  const where: Record<string, unknown> = {
    city_slug: city,
    status,
  };
  if (cause) where.cause_tags = { has: cause };
  if (eventType) where.event_type = eventType;
  if (action) where.action_type = action;
  if (dateFrom || dateTo) {
    where.datetime_iso = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
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
    return Response.json({ events: rows.map(serializeEvent) });
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
