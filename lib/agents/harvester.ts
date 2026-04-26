// lib/agents/harvester.ts
// Tiered, adapter-based ingestion. Each `ingest_method` has a corresponding
// adapter that knows how to talk to that source kind.

import Anthropic from '@anthropic-ai/sdk';
import { HARVESTER_PROMPT } from './prompts';
import { logAgentRun } from './traces';
import { prisma } from '@/lib/db';
import type { SourceRow, NewRawPost, IngestMethod } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface AdapterResult {
  posts: NewRawPost[];
  nextPollAt?: Date;
}

export interface SourceAdapter {
  fetch(source: SourceRow): Promise<AdapterResult>;
}

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

const actionNetworkRssAdapter: SourceAdapter = rssAdapter;

const nycOpenDataAdapter: SourceAdapter = {
  async fetch(source) {
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

const submissionAdapter: SourceAdapter = { async fetch() { return { posts: [] }; } };
const telegramPublicAdapter: SourceAdapter = { async fetch() { return { posts: [] }; } };
const eventbriteApiAdapter: SourceAdapter = { async fetch() { return { posts: [] }; } };
const websiteScrapeAdapter: SourceAdapter = { async fetch() { return { posts: [] }; } };

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

export interface HarvesterRunInput {
  city?: 'nyc' | 'guatemala_city';
  sessionId: string;
}

export interface HarvesterRunResult {
  totalPosts: number;
  eventCandidates: number;
}

const PER_SOURCE_TIMEOUT_MS = 12_000;
const SOURCE_CONCURRENCY = 6;

export async function runHarvester(input: HarvesterRunInput): Promise<HarvesterRunResult> {
  const startedAt = Date.now();
  const dueSources = await fetchSourcesDueForPolling(input.city);

  let totalPosts = 0;
  let eventCandidates = 0;
  let timeouts = 0;
  let errors = 0;

  // Parallel fetch with bounded concurrency + per-source timeout
  for (let i = 0; i < dueSources.length; i += SOURCE_CONCURRENCY) {
    const slice = dueSources.slice(i, i + SOURCE_CONCURRENCY);
    const results = await Promise.allSettled(slice.map(async source => {
      const adapter = adapters[source.ingest_method];
      if (!adapter) return { posts: 0, candidates: 0 };

      try {
        const result = await withTimeout(adapter.fetch(source), PER_SOURCE_TIMEOUT_MS);
        if (!result || result.posts.length === 0) {
          await markPolled(source.id);
          return { posts: 0, candidates: 0 };
        }

        const inserted = await persistRawPosts(result.posts);
        let cand = 0;

        // Classify in small parallel batches too
        const CLASSIFY_CONCURRENCY = 4;
        for (let j = 0; j < inserted.length; j += CLASSIFY_CONCURRENCY) {
          const batch = inserted.slice(j, j + CLASSIFY_CONCURRENCY);
          const classified = await Promise.all(batch.map(async post => {
            const has = await classifyEventSignal({
              text_content: post.text_content,
              image_urls: post.image_urls,
            });
            await prisma.rawPost.update({
              where: { id: post.id },
              data: { has_event_signal: has },
            });
            return has;
          }));
          cand += classified.filter(Boolean).length;
        }

        await markPolled(source.id);
        return { posts: inserted.length, candidates: cand };
      } catch (err) {
        if ((err as Error).message === 'timeout') timeouts += 1;
        else errors += 1;
        console.error(`[harvester] ${source.ingest_method} ${source.display_name}:`, (err as Error).message);
        // Mark polled anyway so we don't keep retrying a flaky feed every call
        try { await markPolled(source.id); } catch {}
        return { posts: 0, candidates: 0 };
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalPosts += r.value.posts;
        eventCandidates += r.value.candidates;
      }
    }
  }

  await logAgentRun({
    sessionId: input.sessionId,
    agentName: 'harvester',
    inputSummary: `${dueSources.length} sources due`,
    outputSummary: `${totalPosts} posts, ${eventCandidates} candidates · ${timeouts}t/${errors}e`,
    reasoningTrace: { sourcesPolled: dueSources.length, totalPosts, eventCandidates, timeouts, errors },
    durationMs: Date.now() - startedAt,
    model: 'mixed',
  });

  return { totalPosts, eventCandidates };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(id); resolve(v); })
     .catch(e => { clearTimeout(id); reject(e); });
  });
}

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

async function fetchSourcesDueForPolling(city?: string): Promise<SourceRow[]> {
  const now = new Date();
  const rows = await prisma.source.findMany({
    where: {
      monitoring_status: 'active',
      NOT: { ingest_method: 'submission' },
      ...(city ? { city_slug: city } : {}),
    },
    take: 20,
  });
  return rows
    .filter(s => {
      if (!s.last_polled_at) return true;
      const due = new Date(s.last_polled_at);
      due.setMinutes(due.getMinutes() + s.poll_interval_minutes);
      return now >= due;
    })
    .map(rowToSource);
}

async function persistRawPosts(posts: NewRawPost[]) {
  if (posts.length === 0) return [] as Array<{ id: string; text_content: string | null; image_urls: string[] }>;
  const inserted: Array<{ id: string; text_content: string | null; image_urls: string[] }> = [];
  for (const p of posts) {
    if (!p.source_id) continue;
    // Manual upsert — skip if same source+external_id already present
    if (p.external_id) {
      const existing = await prisma.rawPost.findFirst({
        where: { source_id: p.source_id, external_id: p.external_id },
        select: { id: true, text_content: true, image_urls: true },
      });
      if (existing) {
        inserted.push(existing);
        continue;
      }
    }
    const created = await prisma.rawPost.create({
      data: {
        source_id: p.source_id,
        external_id: p.external_id,
        url: p.url,
        posted_at: p.posted_at ? new Date(p.posted_at) : null,
        text_content: p.text_content,
        image_urls: p.image_urls ?? [],
      },
      select: { id: true, text_content: true, image_urls: true },
    });
    inserted.push(created);
  }
  return inserted;
}

async function markPolled(sourceId: string) {
  await prisma.source.update({
    where: { id: sourceId },
    data: { last_polled_at: new Date() },
  });
}

function rowToSource(s: {
  id: string; city_slug: string | null; borough: string | null; ingest_method: string;
  source_url: string | null; display_name: string; bio: string | null;
  civic_relevance: unknown; source_category: string[]; primary_causes: string[];
  language: string; monitoring_status: string; poll_interval_minutes: number;
  last_polled_at: Date | null; discovered_via: string | null; created_at: Date;
}): SourceRow {
  return {
    id: s.id,
    city_slug: (s.city_slug ?? 'nyc') as SourceRow['city_slug'],
    borough: s.borough as SourceRow['borough'],
    ingest_method: s.ingest_method as IngestMethod,
    source_url: s.source_url,
    display_name: s.display_name,
    bio: s.bio,
    civic_relevance: s.civic_relevance == null ? null : Number(s.civic_relevance),
    source_category: s.source_category,
    primary_causes: s.primary_causes as SourceRow['primary_causes'],
    language: s.language as SourceRow['language'],
    monitoring_status: s.monitoring_status as SourceRow['monitoring_status'],
    poll_interval_minutes: s.poll_interval_minutes,
    last_polled_at: s.last_polled_at ? s.last_polled_at.toISOString() : null,
    discovered_via: s.discovered_via,
    created_at: s.created_at.toISOString(),
  };
}

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

interface MobilizeEvent {
  id: number; title: string; description?: string; browser_url: string;
  created_date: number; featured_image_url?: string;
  location?: { address_lines?: string[] };
}

interface NycPermittedEvent {
  event_id: string; event_name: string; event_type?: string;
  start_date_time: string; end_date_time?: string;
  event_location?: string; event_borough?: string;
}

interface LegistarEvent {
  EventId: number; EventBodyName: string; EventDate: string;
  EventTime?: string; EventLocation?: string; EventComment?: string;
}
