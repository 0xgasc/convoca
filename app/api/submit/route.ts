// app/api/submit/route.ts
// Community submission endpoint. Accepts image uploads, URLs, or pasted text.
// Acknowledges within ~2 seconds, processes asynchronously via vision extractor.
// Result is published to a matching SSE stream by session_id.

import { supabase } from '@/lib/supabase';
import { runVisionExtractor } from '@/lib/agents/visionExtractor';
import type { CitySlug } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  let submissionType: 'image_upload' | 'url' | 'text';
  let payload: string;
  let sessionId: string;
  let city: CitySlug;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    sessionId = String(form.get('sessionId') ?? '');
    city = (form.get('city') as CitySlug) ?? 'nyc';

    if (!file) return badRequest('Missing image file');
    submissionType = 'image_upload';

    // Upload to Supabase Storage bucket "submissions"
    const buf = Buffer.from(await file.arrayBuffer());
    const path = `submissions/${sessionId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('submissions')
      .upload(path, buf, { contentType: file.type });
    if (uploadErr) return new Response(`Upload failed: ${uploadErr.message}`, { status: 500 });

    const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(path);
    payload = urlData.publicUrl;
  } else {
    const body = await req.json();
    sessionId = String(body.sessionId ?? '');
    city = (body.city as CitySlug) ?? 'nyc';

    if (body.url) {
      submissionType = 'url';
      payload = String(body.url);
    } else if (body.text) {
      submissionType = 'text';
      payload = String(body.text);
    } else {
      return badRequest('Provide one of: image (multipart), url, or text');
    }
  }

  if (!sessionId) return badRequest('Missing sessionId');

  // Create the submission row
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      city_slug: city,
      submitted_by_session: sessionId,
      submission_type: submissionType,
      payload,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !submission) {
    return new Response(`Submission failed: ${error?.message}`, { status: 500 });
  }

  // Process asynchronously — don't block the response
  void processSubmission(submission.id, submissionType, payload, city, sessionId);

  return Response.json({
    submissionId: submission.id,
    status: 'pending',
    message: 'Submission received. Processing...',
  });
}

async function processSubmission(
  submissionId: string,
  type: 'image_upload' | 'url' | 'text',
  payload: string,
  city: CitySlug,
  sessionId: string,
): Promise<void> {
  try {
    await supabase.from('submissions').update({ status: 'processing' }).eq('id', submissionId);

    let imageUrl: string | null = null;
    let postText: string | undefined;

    if (type === 'image_upload') {
      imageUrl = payload;
    } else if (type === 'url') {
      // Fetch HTML, pull OG image + meta
      const meta = await fetchUrlMetadata(payload);
      imageUrl = meta.imageUrl;
      postText = meta.text;
    } else if (type === 'text') {
      postText = payload;
    }

    if (!imageUrl && !postText) {
      await supabase
        .from('submissions')
        .update({ status: 'rejected', rejection_reason: 'No usable content extracted', processed_at: new Date().toISOString() })
        .eq('id', submissionId);
      return;
    }

    if (imageUrl) {
      const event = await runVisionExtractor({
        imageUrl,
        rawPostId: undefined, // not from a harvested post
        city,
        currentDate: new Date().toISOString(),
        postText,
        sessionId,
      });

      if (!event || !event.is_event) {
        await supabase
          .from('submissions')
          .update({ status: 'rejected', rejection_reason: 'Not identified as a civic event', processed_at: new Date().toISOString() })
          .eq('id', submissionId);
        return;
      }

      // Insert canonical event (skipping dedup for hackathon submission flow;
      // production should run dedup against recent events here)
      const { data: inserted } = await supabase
        .from('events')
        .insert({
          city_slug: city,
          title: event.title,
          event_type: event.event_type,
          action_type: event.action_type,
          datetime_iso: event.datetime_iso,
          datetime_text_raw: event.datetime_text_raw,
          location_text: event.location_text,
          location_specificity: event.location_specificity,
          lat: event.lat ?? null,
          lng: event.lng ?? null,
          organizer: event.organizer,
          cause_tags: event.cause_tags,
          language: event.language,
          signup_url: event.signup_url,
          extraction_confidence: event.confidence,
          status: 'upcoming',
        })
        .select('id')
        .single();

      await supabase
        .from('submissions')
        .update({
          status: 'approved',
          result_event_id: inserted?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);
    } else {
      // Text-only path: defer to a text-based parser (not implemented in MVP)
      await supabase
        .from('submissions')
        .update({ status: 'rejected', rejection_reason: 'Text-only submissions not yet supported', processed_at: new Date().toISOString() })
        .eq('id', submissionId);
    }
  } catch (err) {
    console.error('[submit] processing failed', err);
    await supabase
      .from('submissions')
      .update({ status: 'rejected', rejection_reason: String(err), processed_at: new Date().toISOString() })
      .eq('id', submissionId);
  }
}

async function fetchUrlMetadata(url: string): Promise<{ imageUrl: string | null; text: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Convoca/0.1 (+https://convoca.app)' } });
    if (!res.ok) return { imageUrl: null, text: '' };
    const html = await res.text();
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ?? '';
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ?? '';
    return { imageUrl: ogImage, text: `${ogTitle}\n\n${ogDesc}` };
  } catch {
    return { imageUrl: null, text: '' };
  }
}

function badRequest(msg: string) {
  return new Response(msg, { status: 400 });
}
