import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('submissions')
    .select('id, city_slug, submission_type, status, result_event_id, rejection_reason, created_at, processed_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'not found' }, { status: 404 });

  return Response.json({ submission: data });
}
