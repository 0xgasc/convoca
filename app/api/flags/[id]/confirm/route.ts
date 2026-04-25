import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  let sessionId = '';
  try {
    const body = await req.json();
    sessionId = String(body.sessionId ?? '');
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

  const { data: existing, error: fetchErr } = await supabase
    .from('event_flags')
    .select('id, confirmation_count, reporter_session_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return Response.json({ error: 'not found' }, { status: 404 });
  if (existing.reporter_session_id === sessionId) {
    return Response.json({ error: 'cannot confirm own flag' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('event_flags')
    .update({ confirmation_count: (existing.confirmation_count ?? 1) + 1 })
    .eq('id', id)
    .select('id, confirmation_count')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ flag: data });
}
