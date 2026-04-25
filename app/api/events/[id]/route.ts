import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const [eventRes, sourcesRes, flagsRes, runsRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('event_sources')
      .select('raw_post_id, raw_posts!inner(id, url, posted_at, text_content, image_urls, source_id, sources!inner(id, display_name, ingest_method, source_url))')
      .eq('event_id', id),
    supabase
      .from('event_flags')
      .select('*')
      .eq('event_id', id)
      .eq('status', 'approved')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('agent_runs')
      .select('id, agent_name, input_summary, output_summary, reasoning_trace, duration_ms, model, created_at')
      .eq('agent_name', 'dedup')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (eventRes.error) return Response.json({ error: eventRes.error.message }, { status: 500 });
  if (!eventRes.data) return Response.json({ error: 'not found' }, { status: 404 });

  return Response.json({
    event: eventRes.data,
    sources: sourcesRes.data ?? [],
    flags: flagsRes.data ?? [],
    dedup_runs: runsRes.data ?? [],
  });
}
