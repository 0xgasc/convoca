// lib/agents/visionExtractor.ts
// Extracts structured event data from a flyer image. Accepts either a URL
// or an in-memory Buffer (the latter is used by the submit flow so we never
// have to persist the user-uploaded image).

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { VISION_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { prisma } from '@/lib/db';
import { CAUSE_VOCABULARY, EVENT_TYPES, ACTION_TYPES } from '@/lib/constants';
import type { ExtractedEvent } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type SupportedMedia = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const ExtractedEventSchema = z.object({
  is_event: z.boolean(),
  title: z.string(),
  event_type: z.enum(EVENT_TYPES as unknown as [string, ...string[]]),
  action_type: z.enum(ACTION_TYPES as unknown as [string, ...string[]]),
  datetime_iso: z.string().nullable(),
  datetime_text_raw: z.string(),
  end_datetime_iso: z.string().nullable(),
  location_text: z.string(),
  location_specificity: z.enum(['exact_address', 'landmark', 'neighborhood', 'vague', 'online']),
  organizer: z.string().nullable(),
  cause_tags: z.array(z.enum(CAUSE_VOCABULARY as unknown as [string, ...string[]])),
  language: z.enum(['en', 'es', 'mixed']),
  signup_url: z.string().nullable(),
  capacity: z.number().nullable(),
  supplies_needed: z.array(z.string()),
  raw_text_extracted: z.string(),
  confidence: z.number().min(0).max(1),
  confidence_notes: z.string(),
});

export interface VisionExtractorInput {
  // Provide one of:
  imageUrl?: string;
  imageBuffer?: Buffer;
  imageMediaType?: SupportedMedia;
  // Optional metadata
  rawPostId?: string;
  sourceImageUrl?: string;
  city: 'nyc' | 'guatemala_city';
  currentDate: string;
  postText?: string;
  sessionId: string;
}

export async function runVisionExtractor(
  input: VisionExtractorInput
): Promise<ExtractedEvent | null> {
  const startedAt = Date.now();

  let imageData: string;
  let mediaType: SupportedMedia;
  if (input.imageBuffer) {
    imageData = input.imageBuffer.toString('base64');
    mediaType = input.imageMediaType ?? 'image/jpeg';
  } else if (input.imageUrl) {
    try {
      ({ imageData, mediaType } = await fetchImageAsBase64(input.imageUrl));
    } catch (err) {
      console.error('[vision] image fetch failed', input.imageUrl, err);
      return null;
    }
  } else {
    console.error('[vision] no image provided');
    return null;
  }

  const prompt = VISION_PROMPT({
    city: input.city,
    currentDate: input.currentDate,
    postText: input.postText,
  });

  let response: Anthropic.Messages.Message;
  try {
    response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
  } catch (err) {
    console.error('[vision] anthropic call failed', err);
    return null;
  }

  const textBlock = response.content.find(b => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '';

  const parsed = safeJsonParse(rawText);
  if (!parsed) {
    console.warn('[vision] non-JSON response', rawText.slice(0, 200));
    return null;
  }

  const validation = ExtractedEventSchema.safeParse(parsed);
  if (!validation.success) {
    console.warn('[vision] schema validation failed', validation.error.issues);
    await logAgentRun({
      sessionId: input.sessionId,
      agentName: 'vision_extractor',
      inputSummary: `image: ${shortUrl(input.imageUrl ?? 'buffer')}`,
      outputSummary: 'schema_validation_failed',
      reasoningTrace: { rawResponse: parsed, errors: validation.error.issues },
      durationMs: Date.now() - startedAt,
      model: 'claude-opus-4-7',
    });
    return null;
  }

  const event = validation.data as ExtractedEvent;

  if (!event.is_event) {
    await logAgentRun({
      sessionId: input.sessionId,
      agentName: 'vision_extractor',
      inputSummary: `image: ${shortUrl(input.imageUrl ?? 'buffer')}`,
      outputSummary: 'not_an_event',
      reasoningTrace: { confidence_notes: event.confidence_notes },
      durationMs: Date.now() - startedAt,
      model: 'claude-opus-4-7',
    });
    return event;
  }

  if (event.location_text && event.location_specificity !== 'online' && event.location_specificity !== 'vague') {
    const geocoded = await geocode(event.location_text, input.city);
    if (geocoded) {
      (event as ExtractedEvent & { lat?: number; lng?: number }).lat = geocoded.lat;
      (event as ExtractedEvent & { lat?: number; lng?: number }).lng = geocoded.lng;
    }
  }

  if (input.rawPostId) {
    const inserted = await prisma.event.create({
      data: {
        city_slug: input.city,
        title: event.title,
        event_type: event.event_type,
        action_type: event.action_type,
        datetime_iso: event.datetime_iso ? new Date(event.datetime_iso) : null,
        datetime_text_raw: event.datetime_text_raw,
        end_datetime_iso: event.end_datetime_iso ? new Date(event.end_datetime_iso) : null,
        location_text: event.location_text,
        location_specificity: event.location_specificity,
        lat: (event as { lat?: number }).lat ?? null,
        lng: (event as { lng?: number }).lng ?? null,
        organizer: event.organizer,
        cause_tags: event.cause_tags,
        language: event.language,
        signup_url: event.signup_url,
        source_image_url: input.sourceImageUrl ?? input.imageUrl ?? null,
        capacity: event.capacity,
        extraction_confidence: event.confidence,
        status: 'upcoming',
      },
      select: { id: true },
    });

    await prisma.eventSource.create({
      data: {
        event_id: inserted.id,
        raw_post_id: input.rawPostId,
      },
    });
  }

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'vision_extractor',
    inputSummary: `image: ${shortUrl(input.imageUrl ?? 'buffer')}`,
    outputSummary: `${event.title} — ${event.event_type} — conf ${event.confidence.toFixed(2)}`,
    reasoningTrace: event,
    durationMs: Date.now() - startedAt,
    model: 'claude-opus-4-7',
  });

  return event;
}

async function fetchImageAsBase64(url: string): Promise<{
  imageData: string;
  mediaType: SupportedMedia;
}> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';

  let mediaType: SupportedMedia = 'image/jpeg';
  if (contentType.includes('png')) mediaType = 'image/png';
  else if (contentType.includes('webp')) mediaType = 'image/webp';
  else if (contentType.includes('gif')) mediaType = 'image/gif';

  return { imageData: buf.toString('base64'), mediaType };
}

function safeJsonParse(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

function shortUrl(url: string): string {
  return url.split('/').slice(-2).join('/').slice(0, 60);
}

async function geocode(
  query: string,
  city: 'nyc' | 'guatemala_city'
): Promise<{ lat: number; lng: number } | null> {
  if (!process.env.MAPBOX_TOKEN) return null;
  const proximity = city === 'nyc' ? '-74.0060,40.7128' : '-90.5069,14.6349';
  const country = city === 'nyc' ? 'us' : 'gt';
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?proximity=${proximity}&country=${country}&access_token=${process.env.MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const center = json?.features?.[0]?.center;
    if (!center) return null;
    return { lng: center[0], lat: center[1] };
  } catch {
    return null;
  }
}
