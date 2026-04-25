// lib/agents/harvester.ts
// Tiered, adapter-based ingestion. Each `ingest_method` has a corresponding
// adapter that knows how to talk to that source kind. The harvester polls
// `sources` rows whose `last_polled_at` is older than `poll_interval_minutes`
// and dispatches to the right adapter.
//
// Adapters in V1 (all free):
//   rss, ics, mobilize_api, action_network_rss, nyc_open_data, legistar_api,
//   submission
//
// Adapters in V2:
//   telegram_public, eventbrite_api, website_scrape

import Anthropic from '@anthropic-ai/sdk';
import { HARVESTER_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { supabase } from '@/lib/supabase';
import type { SourceRow, NewRawPost, IngestMethod } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// -----------------------------------------------------------------------------
// Adapter interface
// -----------------------------------------------------------------------------

export interface AdapterResult {
  posts: NewRawPost[];
  nextPollAt?: Date;
}

export interface SourceAdapter {
  fetch(source: SourceRow): Promise<AdapterResult>;
}

// -----------------------------------------------------------------------------
// V1 adapters — minimal implementations, expand as needed
// -----------------------------------------------------------------------------

const rssAdapter: SourceAdapter = {
  async fetch(source) {
    if (!source.source_url) return { posts: [] };
    const res = await fetch(source.source_url);
    if (!res.ok) return { posts: [] };
    const xml = await res.text();
    const items = parseRssItems(xml);
    return {
      posts: items.map(item => ({
        source_id: source.id,
        external_id: item.guid,
        url: item.link,
        posted_at: item.pubDate,
        text_content: item.description,
        image_urls: item.imageUrl ? [item.imageUrl] : [],
      })),
    };
  },
};

const icsAdapter: SourceAdapter = {
  async fetch(source) {
    if (!source.source_url) return { posts: [] };
    const res = await fetch(source.source_url);
    if (!res.ok) return { posts: [] };
    const ics = await res.text();
    const events = parseIcsEvents(ics);
    return {
      posts: events.map(ev => ({
        source_id: source.id,
        external_id: ev.uid,
        url: ev.url,
        posted_at: ev.dtstart,
        text_content: `${ev.summary}\n\n${ev.description}\n\nLocation: ${ev.location}`,
        image_urls: [],
      })),
    };
  },
};

const mobilizeApiAdapter: SourceAdapter = {
  async fetch(source) {
    if (!source.source_url) return { posts: [] };
    // source_url is like https://www.mobilize.us/{org_slug}/
    const orgSlug = extractMobilizeSlug(source.source_url);
    if (!orgSlug) return { posts: [] };
    const url = `https://api.mobilize.us/v1/organizations/${orgSlug}/events?per_page=25`;
    const res = await fetch(url);
    if (!res.ok) return { posts: [] };
    const json = await res.json();
    const events = json?.data ?? [];
    return {
      posts: events.map((e: MobilizeEvent) => ({
        source_id: source.id,
        external_id: String(e.id),
        url: e.browser_url,
        posted_at: new Date(e.created_date * 1000).toISOString(),
        text_content: `${e.title}\n\n${e.description ?? ''}\n\n${e.location?.address_lines?.join(', ') ?? ''}`,
        image_urls: e.featured_image_url ? [e.featured_image_url] : [],
      })),
    };
  },
};

const actionNetworkRssAdapter: SourceAdapter = rssAdapter; // AN exposes events as RSS

const nycOpenDataAdapter: SourceAdapter = {
  async fetch(source) {
    // NYC Permitted Event Information dataset via Socrata
    const url = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json?$limit=100&$order=start_date_time%20DESC';
    const res = await fetch(url);
    if (!res.ok) return { posts: [] };
    const events = (await res.json()) as NycPermittedEvent[];
    return {
      posts: events.map(e => ({
        source_id: source.id,
        external_id: e.event_id,
        url: 'https://data.cityofnewyork.us/d/tvpp-9vvx',
        posted_at: e.start_date_time,
        text_content: `${e.event_name}\n\n${e.event_type ?? ''}\n\nLocation: ${e.event_location ?? ''}\nBorough: ${e.event_borough ?? ''}\nFrom ${e.start_date_time} to ${e.end_date_time ?? ''}`,
        image_urls: [],
      })),
    };
  },
};

const legistarApiAdapter: SourceAdapter = {
  async fetch(source) {
    // NYC Council hearings + stated meetings via Legistar API
    const url = 'https://webapi.legistar.com/v1/nyc/Events?$top=50&$orderby=EventDate%20desc';
    const res = await fetch(url);
    if (!res.ok) return { posts: [] };
    const events = (await res.json()) as LegistarEvent[];
    return {
      posts: events.map(e => ({
        source_id: source.id,
        external_id: String(e.EventId),
        url: `https://legistar.council.nyc.gov/MeetingDetail.aspx?ID=${e.EventId}`,
        posted_at: e.EventDate,
        text_content: `${e.EventBodyName}: ${e.EventComment ?? ''}\n\nLocation: ${e.EventLocation ?? ''}\nDate: ${e.EventDate} ${e.EventTime ?? ''}`,
        image_urls: [],
      })),
    };
  },
};

const submissionAdapter: SourceAdapter = {
  async fetch() {
    // Submissions are pulled from the `submissions` table by a separate worker.
    // This adapter is here for completeness so the source row exists.
    return { posts: [] };
  },
};

// V2 adapters — implement when prioritized
const telegramPublicAdapter: SourceAdapter = {
  async fetch() {
    // TODO: use Telegram Bot API getUpdates for public channels
    return { posts: [] };
  },
};

const eventbriteApiAdapter: SourceAdapter = {
  async fetch() {
    // TODO: Eventbrite API key required, organization-events endpoint
    return { posts: [] };
  },
};

const websiteScrapeAdapter: SourceAdapter = {
  async fetch() {
    // TODO: per-source HTML parsing, last resort
    return { posts: [] };
  },
};

const adapters: Record<IngestMethod, SourceAdapter> = {
  rss: rssAdapter,
  ics: icsAdapter,
  mobilize_api: mobilizeApiAdapter,
  action_network_rss: actionNetworkRssAdapter,
  nyc_open_data: nycOpenDataAdapter,
  legistar_api: legistarApiAdapter,
  submission: submissionAdapter,
  telegram_public: telegramPublicAdapter,
  eventbrite_api: eventbriteApiAdapter,
  website_scrape: websiteScrapeAdapter,
};

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

export interface HarvesterRunInput {
  city?: 'nyc' | 'guatemala_city';
  sessionId: string;
}

export interface HarvesterRunResult {
  totalPosts: number;
  eventCandidates: number;
}

export async function runHarvester(input: HarvesterRunInput): Promise<HarvesterRunResult> {
  const startedAt = Date.now();
  const dueSources = await fetchSourcesDueForPolling(input.city);

  let totalPosts = 0;
  let eventCandidates = 0;

  for (const source of dueSources) {
    const adapter = adapters[source.ingest_method];
    if (!adapter) continue;

    try {
      const result = await adapter.fetch(source);
      if (result.posts.length === 0) {
        await markPolled(source.id);
        continue;
      }

      // Persist raw posts (de-dup on external_id)
      const inserted = await persistRawPosts(result.posts);
      totalPosts += inserted.length;

      // Triage classification (Haiku — cheap)
      for (const post of inserted) {
        const hasEventSignal = await classifyEventSignal({
          text_content: post.text_content ?? null,
          image_urls: post.image_urls ?? [],
        });
        if (hasEventSignal) eventCandidates += 1;
        await supabase
          .from('raw_posts')
          .update({ has_event_signal: hasEventSignal })
          .eq('id', post.id);
      }

      await markPolled(source.id);
    } catch (err) {
      console.error(`[harvester] adapter ${source.ingest_method} failed for ${source.display_name}:`, err);
    }
  }

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'harvester',
    inputSummary: `${dueSources.length} sources due`,
    outputSummary: `${totalPosts} posts harvested, ${eventCandidates} event candidates`,
    reasoningTrace: { sourcesPolled: dueSources.length, totalPosts, eventCandidates },
    durationMs: Date.now() - startedAt,
    model: 'mixed',
  });

  return { totalPosts, eventCandidates };
}

// -----------------------------------------------------------------------------
// Triage classifier (Haiku)
// -----------------------------------------------------------------------------

async function classifyEventSignal(post: { text_content?: string | null; image_urls: string[] }): Promise<boolean> {
  if (!post.text_content && post.image_urls.length === 0) return false;
  const prompt = HARVESTER_PROMPT({
    postText: post.text_content ?? '',
    hasImage: post.image_urls.length > 0,
  });
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    const reply = textBlock?.type === 'text' ? textBlock.text.trim().toLowerCase() : '';
    return reply.startsWith('yes');
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Supabase helpers
// -----------------------------------------------------------------------------

async function fetchSourcesDueForPolling(city?: string): Promise<SourceRow[]> {
  const now = new Date();
  let q = supabase
    .from('sources')
    .select('*')
    .eq('monitoring_status', 'active')
    .neq('ingest_method', 'submission');
  if (city) q = q.eq('city_slug', city);

  const { data } = await q.limit(20);
  return (data ?? []).filter((s: SourceRow) => {
    if (!s.last_polled_at) return true;
    const due = new Date(s.last_polled_at);
    due.setMinutes(due.getMinutes() + s.poll_interval_minutes);
    return now >= due;
  }) as SourceRow[];
}

async function persistRawPosts(posts: NewRawPost[]): Promise<Array<NewRawPost & { id: string }>> {
  if (posts.length === 0) return [];
  const { data } = await supabase
    .from('raw_posts')
    .upsert(posts, { onConflict: 'external_id', ignoreDuplicates: true })
    .select('*');
  return (data ?? []) as Array<NewRawPost & { id: string }>;
}

async function markPolled(sourceId: string) {
  await supabase
    .from('sources')
    .update({ last_polled_at: new Date().toISOString() })
    .eq('id', sourceId);
}

// -----------------------------------------------------------------------------
// Minimal RSS / ICS parsers (no external deps for hackathon)
// For production, swap in `rss-parser` and `ical.js`.
// -----------------------------------------------------------------------------

interface RssItem { guid?: string; link?: string; pubDate?: string; description?: string; imageUrl?: string }
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));
  for (const m of itemMatches) {
    const block = m[1];
    items.push({
      guid: extract(block, 'guid'),
      link: extract(block, 'link'),
      pubDate: extract(block, 'pubDate'),
      description: extract(block, 'description'),
      imageUrl: extractAttr(block, 'enclosure', 'url') ?? extract(block, 'media:content'),
    });
  }
  return items;
}

interface IcsEvent { uid?: string; url?: string; dtstart?: string; summary?: string; description?: string; location?: string }
function parseIcsEvents(ics: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const veventBlocks = ics.split('BEGIN:VEVENT').slice(1);
  for (const block of veventBlocks) {
    const ev: IcsEvent = {};
    block.split('\n').forEach(line => {
      const [keyRaw, ...rest] = line.split(':');
      const key = keyRaw.split(';')[0].trim();
      const val = rest.join(':').trim();
      if (key === 'UID') ev.uid = val;
      else if (key === 'URL') ev.url = val;
      else if (key === 'DTSTART') ev.dtstart = val;
      else if (key === 'SUMMARY') ev.summary = val;
      else if (key === 'DESCRIPTION') ev.description = val;
      else if (key === 'LOCATION') ev.location = val;
    });
    events.push(ev);
  }
  return events;
}

function extract(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return undefined;
  return m[1].replace(/<!\[CDATA\[/, '').replace(/\]\]>/, '').trim();
}

function extractAttr(xml: string, tag: string, attr: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`));
  return m?.[1];
}

function extractMobilizeSlug(url: string): string | null {
  const m = url.match(/mobilize\.us\/([^/]+)/);
  return m?.[1] ?? null;
}

// -----------------------------------------------------------------------------
// Adapter response types
// -----------------------------------------------------------------------------

interface MobilizeEvent {
  id: number;
  title: string;
  description?: string;
  browser_url: string;
  created_date: number;
  featured_image_url?: string;
  location?: { address_lines?: string[] };
}

interface NycPermittedEvent {
  event_id: string;
  event_name: string;
  event_type?: string;
  start_date_time: string;
  end_date_time?: string;
  event_location?: string;
  event_borough?: string;
}

interface LegistarEvent {
  EventId: number;
  EventBodyName: string;
  EventDate: string;
  EventTime?: string;
  EventLocation?: string;
  EventComment?: string;
}
