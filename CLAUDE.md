# Convoca — Civic & Community Discovery

> Open-source, agent-powered discovery layer for IRL events that build community across NYC and Guatemala City — protests, town halls, volunteer opportunities, mutual aid, free cultural programming, community gatherings. Hackathon MVP showcases Claude Opus 4.7 multi-agent orchestration and vision on real-world bilingual content.

## What Convoca Is (and Isn't)

**In scope** — IRL events that build community fabric:
- Civic action: protests, marches, rallies, vigils, direct actions
- Civic deliberation: town halls, public hearings, community board meetings
- Mutual aid: food distributions, fridge restocks, supply drives, community fridges
- Volunteering: park cleanups, garden workdays, tutoring, soup kitchens
- Free public culture: outdoor concerts, library programs, free museum days, public readings, community-run art openings, block parties
- Skill-shares, know-your-rights clinics, free schools, teach-ins
- Community markets, swaps, repair cafes

**Out of scope** — not what we exist for:
- Ticketed concerts, paid classes, commercial entertainment
- Restaurant/nightlife/club listings
- Branded marketing pop-ups (the "ERLY skincare launch" type)
- Anything where the primary frame is consumption rather than participation

This is a curatorial choice, not a technical one. The agents will encounter many ineligible events; the harvester filters them out at classification time.

## Why This Exists

Civic and community information is fragmented across Instagram, Telegram, Twitter/X, Facebook events, Eventbrite, Mobilize, neighborhood listservs, RSS feeds, physical flyers, and dozens of borough-level newsletters. Multiple human-curated aggregators exist (mutualaid.nyc, actions.nyc, protest.one, handsoffnyc.com, theskint, Indypendent, nyc-noise.com) — they prove the demand and do extraordinary work, but each covers one slice and depends on volunteer labor that doesn't scale.

Convoca is what happens when you put agents underneath that human curation work — not replacing the curators, but giving them and their users a unified, multilingual, hyperlocal interface backed by reasoning models.

## Hackathon Goal

Three Opus 4.7 wow moments:

1. **Vision on real-world bilingual flyers** — extracting structured events from hand-designed IG screenshots in Spanish/English.
2. **Cross-source semantic dedup with visible reasoning** — same event posted three different ways across platforms, merged into one canonical event with the agent's judgment trace exposed.
3. **One-tap action + community submit** — judge sees an event and signs up via deep-link; judge drags a fresh flyer in and watches the agent process it live. Both the discovery loop and the contribution loop, on stage.

## Launch Cities

- **NYC** (`city_slug: 'nyc'`) — primary English plus Spanish for Washington Heights, Sunset Park, Corona, Bushwick, Jackson Heights, etc.
- **Guatemala City** (`city_slug: 'guatemala_city'`) — primary Spanish.

Architecture is multi-city by default. New city = insert a `cities` row + seed sources.

## Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Map**: Mapbox GL JS
- **DB**: Supabase (Postgres + pgvector + storage)
- **Agents**: Anthropic SDK directly
- **Models**:
  - Opus 4.7 (`claude-opus-4-7`) → Intent Parse, Discovery, Vision Extractor, Dedup, Recommender, Safety Review
  - Haiku 4.5 (`claude-haiku-4-5-20251001`) → Harvester triage classifier
- **Streaming**: SSE from Next.js route handlers
- **Geocoding**: Mapbox Geocoding API
- **Embeddings**: Voyage AI (`voyage-3`) for dedup shortlist
- **Deploy**: Vercel + Supabase

## Ingestion Philosophy: Community-Fed, Agent-Amplified

See `INGESTION.md` for the full statement. Three operating principles:

1. **Consent-first**: pull only from sources that publish openly (public APIs, RSS, ICS, Telegram public channels, city open data) or that community members submit to us.
2. **Agents do labor, not surveillance**: no user profiling, no attendee lists, no social graph derivation.
3. **Submit-as-primary-input**: the most powerful ingest channel is one tap from a community member.

Concretely: we do **not** scrape Instagram, Facebook, or any logged-in platform. When an IG-only flyer needs to enter the system, a community member shares the URL or screenshot via `/submit`.

## Database Schema

```sql
create table cities (
  slug text primary key,
  display_name text not null,
  country text not null,
  default_language text not null,
  center_lat numeric(9,6) not null,
  center_lng numeric(9,6) not null,
  timezone text not null
);

insert into cities values
  ('nyc', 'New York City', 'US', 'en', 40.7128, -74.0060, 'America/New_York'),
  ('guatemala_city', 'Ciudad de Guatemala', 'GT', 'es', 14.6349, -90.5069, 'America/Guatemala');

-- Sources we monitor
create table sources (
  id uuid primary key default gen_random_uuid(),
  city_slug text references cities(slug),
  borough text,                        -- nyc only: 'manhattan','brooklyn','queens','bronx','staten_island','citywide'
  ingest_method text not null check (ingest_method in (
    'rss','ics','mobilize_api','action_network_rss','telegram_public',
    'eventbrite_api','nyc_open_data','legistar_api','website_scrape',
    'submission'
  )),
  source_url text,                     -- feed URL or API endpoint
  display_name text not null,
  bio text,
  civic_relevance numeric(3,2),
  source_category text[] default '{}', -- 'mutual_aid','protest_org','volunteer_coord','library','park','community_org','tenant_union','arts','government'
  primary_causes text[] default '{}',
  language text default 'en',
  monitoring_status text default 'active' check (monitoring_status in ('active','paused','rejected')),
  poll_interval_minutes int default 60,
  last_polled_at timestamptz,
  discovered_via uuid references sources(id),
  created_at timestamptz default now(),
  unique(ingest_method, source_url)
);

create table raw_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  external_id text,
  url text,
  posted_at timestamptz,
  text_content text,
  image_urls text[] default '{}',
  has_event_signal boolean default false,
  is_in_scope boolean,                 -- haiku triage: civic/community vs commercial
  fetched_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  city_slug text references cities(slug),
  title text not null,
  event_type text not null check (event_type in (
    'protest','march','rally','town_hall','public_hearing',
    'volunteer_opportunity','mutual_aid_distribution','community_meeting',
    'teach_in','vigil','commemoration','skill_share','clinic',
    'direct_action','cultural_event','free_public_program','community_market',
    'block_party','other'
  )),
  action_type text default 'attend' check (action_type in (
    'attend','rsvp','register','bring_supplies','donate','amplify'
  )),
  datetime_iso timestamptz,
  datetime_text_raw text,
  end_datetime_iso timestamptz,
  location_text text,
  location_specificity text check (location_specificity in (
    'exact_address','landmark','neighborhood','vague','online'
  )),
  lat numeric(9,6),
  lng numeric(9,6),
  organizer text,
  cause_tags text[] default '{}',
  language text default 'en',
  signup_url text,
  capacity int,
  signup_deadline timestamptz,
  status text default 'upcoming' check (status in (
    'upcoming','live','ended','cancelled'
  )),
  extraction_confidence numeric(3,2),
  embedding vector(1024),
  created_at timestamptz default now()
);

create table event_sources (
  event_id uuid references events(id) on delete cascade,
  raw_post_id uuid references raw_posts(id) on delete cascade,
  primary key (event_id, raw_post_id)
);

-- Hyperlocal community safety + supply flags
create table event_flags (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  city_slug text references cities(slug),
  flag_type text not null check (flag_type in (
    'ice_presence','police_presence','route_change','counter_protest',
    'dispersal_warning','disinfo','medical_aid','safe_space',
    'supplies_needed','signup_full','transport_offer','other'
  )),
  severity text default 'caution' check (severity in ('info','caution','urgent')),
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  note text,
  reporter_session_id text not null,
  confirmation_count int default 1,
  status text default 'pending' check (status in ('pending','approved','blocked','review')),
  safety_review_reasoning text,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table flag_type_config (
  flag_type text primary key,
  default_ttl_minutes int not null,
  icon text, color text,
  display_label_es text, display_label_en text,
  applicable_cities text[] default '{nyc,guatemala_city}'
);

-- Submissions queue for community-contributed flyers/URLs
create table submissions (
  id uuid primary key default gen_random_uuid(),
  city_slug text references cities(slug),
  submitted_by_session text,
  submission_type text not null check (submission_type in ('image_upload','url','text')),
  payload text not null,               -- url, image storage path, or text
  status text default 'pending' check (status in ('pending','processing','approved','rejected','duplicate')),
  result_event_id uuid references events(id),
  rejection_reason text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create table user_sessions (
  id text primary key,
  city_slug text references cities(slug),
  cause_prefs text[] default '{}',
  action_prefs text[] default '{attend}',
  language text default 'en',
  neighborhood text,
  created_at timestamptz default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  agent_name text not null,
  input_summary text,
  output_summary text,
  reasoning_trace jsonb,
  duration_ms int,
  model text,
  created_at timestamptz default now()
);

create extension if not exists vector;
create index on events using ivfflat (embedding vector_cosine_ops);
create index on events (datetime_iso) where status = 'upcoming';
create index on event_flags (created_at desc) where status = 'approved';
```

## Tiered Harvester — All Free Sources

The harvester has one job: turn external feeds into `raw_posts` rows. It dispatches to typed adapters keyed off `sources.ingest_method`. All adapters run on a polling cron (`poll_interval_minutes` per source).

### Adapter pattern

```ts
// lib/agents/harvester/index.ts
type AdapterResult = { posts: NewRawPost[]; nextPollAt: Date };

interface SourceAdapter {
  fetch(source: SourceRow): Promise<AdapterResult>;
}

const adapters: Record<string, SourceAdapter> = {
  rss: new RssAdapter(),
  ics: new IcsAdapter(),
  mobilize_api: new MobilizeApiAdapter(),
  action_network_rss: new ActionNetworkRssAdapter(),
  telegram_public: new TelegramPublicAdapter(),
  eventbrite_api: new EventbriteApiAdapter(),
  nyc_open_data: new NycOpenDataAdapter(),
  legistar_api: new LegistarApiAdapter(),
  website_scrape: new WebsiteScrapeAdapter(),
  submission: new SubmissionAdapter(),
};

export async function runHarvester() {
  const dueSources = await fetchSourcesDueForPolling();
  for (const src of dueSources) {
    const adapter = adapters[src.ingest_method];
    if (!adapter) continue;
    const result = await adapter.fetch(src);
    await persistRawPosts(result.posts);
    await markPolled(src.id, result.nextPollAt);
  }
}
```

### Adapter cheatsheet

| ingest_method | What it pulls | Auth needed |
|---|---|---|
| `rss` | Org website feeds (350NYC, NYPL, parks, etc.) | None |
| `ics` | Library/parks/community board calendars | None |
| `mobilize_api` | Public events from any Mobilize org | None for read; rate-limit 15 req/s |
| `action_network_rss` | Public AN events feed per org | None |
| `telegram_public` | Public Telegram channel messages | Bot token (free) |
| `eventbrite_api` | Org-public events | API key (free tier) |
| `nyc_open_data` | NYC Permitted Event Information dataset | None (Socrata API) |
| `legistar_api` | NYC Council hearings + stated meetings | None |
| `website_scrape` | Org sites without feeds (last resort) | None; gentle scraping |
| `submission` | Community-contributed URLs/images | Session-rate-limited |

### What we never ingest

- Instagram (no API for non-owned content; ToS-blocked at scale)
- Facebook (same)
- Logged-in/private platforms

For IG/FB-only content, the path is `/submit` — community members hand us URLs or screenshots. Stated explicitly in `INGESTION.md`.

## Submit Flow

`POST /api/submit` accepts:
- `submission_type: 'image_upload'` — multipart, image goes to Supabase Storage
- `submission_type: 'url'` — any URL (IG post URL, org page, anything)
- `submission_type: 'text'` — pasted plaintext announcement

Pipeline:
1. Submission lands in `submissions` table with `status: 'pending'`
2. Background worker picks it up
3. If image → run vision extractor directly
4. If URL → fetch HTML, extract OG metadata + first image, then route to vision extractor or text parser
5. If text → run a text-based event extractor (mini variant of vision prompt)
6. Result feeds into the same dedup pipeline as harvested posts
7. `status` updates to `approved` (with `result_event_id`) or `rejected` (with `rejection_reason`)

UX: drag-and-drop on the homepage, plus a persistent "Saw a flyer? Drop it here" affordance. Acknowledge submission in <2s, post final event link via SSE when processing completes.

## Agent Architecture

```
                     ┌────────────────┐
   user prompt  ───▶ │  Orchestrator  │ ───▶ SSE stream → UI
                     └────────┬───────┘
                              │
   ┌──────────┬──────────┬────┼────┬─────────────┬─────────────┐
   ▼          ▼          ▼    ▼    ▼             ▼             ▼
  Intent  Discovery Harvester Vision  Dedup  Recommender   Safety
  Parse    (Opus)   (Haiku)   (Opus) (Opus)   (Opus)       Review
  (Opus)                                                    (Opus)
```

All seven prompts live in `lib/agents/prompts.ts`. Reference implementation in `lib/agents/visionExtractor.ts`. See those files (separate artifacts).

## Frontend Structure

```
app/
  page.tsx                          Map + chat split view
  events/[id]/page.tsx              Event detail + flags
  submit/page.tsx                   Submit a flyer/URL
  about/page.tsx                    OSS pitch + ingestion principles
  layout.tsx
components/
  Map/                              MapView, EventMarkers, FlagOverlay, FlagModal
  Chat/                             ChatInput, AgentTrace, EventCard
  EventDetail/                      SignupCTA, SourcesList, ReasoningTrace
  Submit/                           DropZone, SubmissionStatus, RecentSubmissions
  Onboarding/                       CityPicker, CausePicker, ActionPrefPicker, LanguageToggle
lib/
  agents/                           prompts, orchestrator, intentParse, discovery,
                                    harvester (with adapters/), visionExtractor,
                                    dedup, recommender, safetyReview, traces
  supabase.ts
  mapbox.ts
  constants/                        causes, eventTypes, flagTypes
  types.ts
```

## API Routes

```
POST   /api/orchestrate           SSE: full agent flow for a user prompt
POST   /api/harvest               trigger harvester (cron in prod)
POST   /api/extract               run vision on a raw_post
POST   /api/dedup                 run dedup on recent extractions
POST   /api/submit                community submission (multipart or JSON)
GET    /api/submissions/:id       submission status (poll or SSE)
GET    /api/events                list (filters: city, cause, date, type, action)
GET    /api/events/:id            single event with sources + flags
POST   /api/flags                 submit safety flag (runs Safety Review inline)
POST   /api/flags/:id/confirm     "I see this too"
GET    /api/flags                 live flags (filters: city, bbox, type, since)
GET    /api/agent-runs/:session   reasoning traces for live demo panel
```

## Seed Data — NYC + Guate

See `nyc-sources.md` for the full borough-by-borough NYC source registry (~80 sources including all 5 boroughs, Mobilize feeds, NYC Open Data, Legistar, library/parks ICS, plus mutual aid orgs).

For Guate, hand-curate ~10 sources: Codeca, Movimiento Semilla–aligned orgs, neighborhood associations Zona 1/Zona 10, indigenous rights coalitions, local mutual aid groups. Most ingest via Telegram public channels and org RSS where available.

Manually save 30-40 real flyer images for vision extractor iteration. Hold back 5 for live demo (3 easy, 1 hard, 1 multi-language).

Hand-craft 8-10 example community flags showing different `flag_type`s.

## Build Order (48h)

**Hour 0-4 — Foundation**
- Next.js + Tailwind + shadcn bootstrap
- Supabase project + run schema SQL + seed cities + flag_type_config
- Anthropic SDK wired with both models
- Mapbox view rendering NYC + Guate (toggle)

**Hour 4-12 — Vision extractor (wow #1)**
- Implement `lib/agents/visionExtractor.ts` per reference artifact
- Test on 30 real flyers, iterate `VISION_PROMPT` until ≥80% acceptable
- Seed `events` table from extractions

**Hour 12-18 — Submit flow**
- `/api/submit` route + Supabase Storage for images
- DropZone component on homepage
- Background worker calls vision extractor, posts result via SSE

**Hour 18-24 — Tiered harvester**
- Implement RSS, ICS, Mobilize API, NYC Open Data, Legistar adapters (skip Telegram + Eventbrite for hackathon)
- Seed sources table from `nyc-sources.md`
- Cron via Vercel scheduled function

**Hour 24-30 — Dedup (wow #2)**
- pgvector + Voyage embeddings shortlist
- `lib/agents/dedup.ts` with reasoning trace
- ReasoningTrace UI

**Hour 30-36 — Orchestrator + chat + recommender**
- `/api/orchestrate` SSE
- AgentTrace consuming SSE
- Recommender with inline reasoning

**Hour 36-42 — Safety layer + polish**
- Flag submission + Safety Review
- City-aware flag types (no ICE in Guate)
- Onboarding flow
- Mobile responsive

**Hour 42-46 — Demo prep**
- Rehearse 3-min flow 10x
- Record backup video
- 5 hand-vetted flyers + 1 dedup case + 1 submit case ready
- Verbal script

**Hour 46-48 — Sleep, eat, no commits**

## Out of Scope

Auth/accounts (session only), push/email/WhatsApp notifications, organizer verification, more than NYC + Guate, production threat modeling, monetization, IG/FB scraping, persistent user history.

All roadmap, not hackathon.

## Demo Script (3 minutes)

[0:00-0:25] Hook
> "Civic and community life is broken at the discovery layer. Last weekend in NYC there were over 200 organized events that build community — protests, mutual aid distributions, free concerts, volunteer cleanups, town halls, library readings. The average New Yorker who actively cares heard about maybe 8. Convoca is an open-source agent layer that fixes this, powered by Claude Opus 4.7."

[0:25-0:55] One prompt, agents go
*Type live*: "Find housing-related events in NYC this weekend, attend or volunteer"
> "Six agents kick off. Intent parse already understood I'll attend or volunteer."

[0:55-1:35] Vision wow + submit
*Drag a fresh bilingual IG flyer screenshot*
> "Anyone in this audience can submit a flyer — anyone, anywhere. Watch."
*JSON appears live*
> "Title, datetime, organizer, cause tags, action type, language. Confidence 0.91. The pin lands on the map."

[1:35-2:15] Dedup wow
*Click "5 sources" badge*
> "Five orgs posted this same Saturday food distribution. Different platforms, different wording. Watch the agent reason."
*Reasoning trace expands*
> "Same parish, datetimes within 30 minutes, organizers in known coalition. Merged at 0.94. Cross-source judgment is what makes this only possible with a reasoning model."

[2:15-2:40] Action + safety
*Tap "Sign up" — deep-links to Mobilize*
> "One tap from discovery to action. And because events are dynamic, attendees flag what they see in real time."
*Drop a 'medical_aid' flag*
> "Each flag goes through a safety review agent that blocks doxxing and spam but errs toward approval. Real-time info matters when you're on the ground."

[2:40-3:00] Close
> "Open source from day one. Community-fed, agent-amplified. Same architecture works for any city, any language, any cause. Convoca."

## OSS Positioning

Public repo from day one. License: MIT (lean), or AGPL if we want copyleft on the safety/community-flag logic specifically. README leads with `INGESTION.md`'s framing — what we ingest, what we never will, and why.

## Naming Note

`Convoca` works in Spanish ("to summon/call together") and reads as a verb in English. Alts: IRL, Plaza, Aldea, Mesa, Showup, Civica.

## Notes for Claude Code

- Build agents one at a time. Test each in `scripts/test-X.ts` with real fixtures before wiring to API.
- Vision extractor is highest-leverage prompt — third of total time on iteration.
- Reasoning traces are the product, not debug. Render prominently.
- Submit flow needs to feel instant — acknowledge in <2s, push final result via SSE.
- Default UI in user's browser language (es/en), with manual toggle.
- All production prompts live in `lib/agents/prompts.ts` — see separate artifact.
- Use `nyc-sources.md` to seed the `sources` table at install time.
- Use `INGESTION.md` as the basis for the public README intro.
