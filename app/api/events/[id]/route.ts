import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return Response.json({ error: 'not found' }, { status: 404 });

    const [eventSources, flags, dedupRuns] = await Promise.all([
      prisma.eventSource.findMany({
        where: { event_id: id },
        select: {
          raw_post_id: true,
          raw_post: {
            select: {
              id: true, url: true, posted_at: true, text_content: true, image_urls: true, source_id: true,
              source: { select: { id: true, display_name: true, ingest_method: true, source_url: true } },
            },
          },
        },
      }),
      prisma.eventFlag.findMany({
        where: { event_id: id, status: 'approved', expires_at: { gt: new Date() } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.agentRun.findMany({
        where: { agent_name: 'dedup' },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ]);

    return Response.json({
      event: {
        ...event,
        datetime_iso: event.datetime_iso?.toISOString() ?? null,
        end_datetime_iso: event.end_datetime_iso?.toISOString() ?? null,
        signup_deadline: event.signup_deadline?.toISOString() ?? null,
        lat: event.lat == null ? null : Number(event.lat),
        lng: event.lng == null ? null : Number(event.lng),
        extraction_confidence: event.extraction_confidence == null ? null : Number(event.extraction_confidence),
        created_at: event.created_at.toISOString(),
      },
      sources: eventSources.map(es => ({
        raw_post_id: es.raw_post_id,
        raw_posts: es.raw_post && {
          id: es.raw_post.id,
          url: es.raw_post.url,
          posted_at: es.raw_post.posted_at?.toISOString() ?? null,
          text_content: es.raw_post.text_content,
          image_urls: es.raw_post.image_urls,
          source_id: es.raw_post.source_id,
          sources: es.raw_post.source && {
            id: es.raw_post.source.id,
            display_name: es.raw_post.source.display_name,
            ingest_method: es.raw_post.source.ingest_method,
            source_url: es.raw_post.source.source_url,
          },
        },
      })),
      flags: flags.map(f => ({
        ...f,
        lat: Number(f.lat), lng: Number(f.lng),
        created_at: f.created_at.toISOString(),
        expires_at: f.expires_at.toISOString(),
      })),
      dedup_runs: dedupRuns.map(r => ({
        ...r,
        created_at: r.created_at.toISOString(),
      })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
