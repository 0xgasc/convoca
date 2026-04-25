import { prisma } from '@/lib/db';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CITIES: CitySlug[] = ['nyc', 'guatemala_city'];

interface SessionPayload {
  id: string;
  city_slug?: CitySlug;
  cause_prefs?: string[];
  action_prefs?: string[];
  language?: 'en' | 'es';
  neighborhood?: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const session = await prisma.userSession.findUnique({ where: { id } });
  return Response.json({
    session: session && {
      ...session,
      created_at: session.created_at.toISOString(),
    },
  });
}

export async function POST(req: Request) {
  let body: SessionPayload;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });
  if (body.city_slug && !VALID_CITIES.includes(body.city_slug)) {
    return Response.json({ error: 'invalid city_slug' }, { status: 400 });
  }

  const data = {
    city_slug: body.city_slug ?? 'nyc',
    cause_prefs: body.cause_prefs ?? [],
    action_prefs: body.action_prefs ?? ['attend'],
    language: body.language ?? 'en',
    neighborhood: body.neighborhood ?? null,
  };

  try {
    const session = await prisma.userSession.upsert({
      where: { id: body.id },
      create: { id: body.id, ...data },
      update: data,
    });
    return Response.json({
      session: { ...session, created_at: session.created_at.toISOString() },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
