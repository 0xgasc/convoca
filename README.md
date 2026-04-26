# Convoca

**Civic and community life generates hundreds of organized events every weekend. Most people who care hear about 5% of them.** Convoca is an open-source, agent-powered discovery layer that pulls from every public source — RSS feeds, city APIs, Telegram channels, community-submitted flyers — and makes the full picture visible, searchable, and actionable in one place.

Built with Claude Opus 4.7 for the Anthropic hackathon. Launching in NYC and Guatemala City.

---

## What it does

### 1. Vision on real-world bilingual flyers
Drag a screenshot from Instagram, a photo of a church bulletin board, a WhatsApp-forwarded flyer. The vision agent reads it — title, date, location, organizer, action type, cause tags, language — and pins it on the map within seconds. Confidence score included. No manual data entry.

### 2. Cross-source semantic dedup with visible reasoning
The same Saturday food distribution gets posted by five organizations: different platforms, different wording, different times listed. The dedup agent merges them into one canonical event and shows its work — which signals it weighted, why the datetime discrepancy didn't block the merge, what confidence it landed at. This judgment is only possible with a reasoning model, and you can watch it happen live.

### 3. One-tap action + community submit loop
From discovery to signup is one tap — deep-linked to the organizer's existing Mobilize or Action Network form, no Convoca account required. Attendees in the field flag what they see in real time (route changes, medical aid stations, ICE presence, supplies needed). Each flag goes through a safety review agent that blocks doxxing and spam but errs hard toward approval, because real-time ground truth matters.

---

## Agent architecture

```
                 ┌────────────────┐
 user prompt ──▶ │  Orchestrator  │ ──▶ SSE stream → UI trace panel
                 └────────┬───────┘
                          │
 ┌──────────┬──────────┬──┴──────┬──────────┬─────────────┬──────────────┐
 ▼          ▼          ▼         ▼          ▼             ▼              ▼
Intent   Discovery  Harvester  Vision    Dedup       Recommender    Safety
Parse     (Opus)    (Haiku)    (Opus)   (Opus)        (Opus)        Review
(Opus)                                                               (Opus)
```

| Agent | Model | What it does |
|---|---|---|
| **Intent Parse** | Opus 4.7 | Turns free-text prompts into structured filters (city, cause, date range, action preference, language) |
| **Discovery** | Opus 4.7 | Snowballs new civic-relevant sources from seed URLs — finds the Telegram channel from the org's Linktree |
| **Harvester** | Haiku 4.5 | Triage classifier; typed adapters for RSS, ICS, Mobilize API, Action Network, NYC Open Data, Legistar, public Telegram, and community submissions |
| **Vision Extractor** | Opus 4.7 | Structures bilingual flyers and screenshots into typed `events` rows with confidence scores |
| **Dedup** | Opus 4.7 | Voyage AI embedding shortlist → semantic merge with full reasoning trace surfaced in UI |
| **Recommender** | Opus 4.7 | Ranks events for a session's cause/action/neighborhood prefs with one-sentence reasoning per result |
| **Safety Review** | Opus 4.7 | Reviews community-submitted flags before publishing — blocks doxxing/spam, approves ground-truth reports |

All seven prompts live in `lib/agents/prompts.ts`. Reasoning traces are first-class UI, not debug output.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| Map | Mapbox GL JS |
| Database | Postgres + pgvector (Railway) + Prisma |
| Agents | Anthropic SDK — Opus 4.7 + Haiku 4.5 |
| Embeddings | Voyage AI (`voyage-3`) for dedup shortlist |
| Streaming | SSE from Next.js route handlers |
| Email | Resend |
| Deploy | Vercel + Railway |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/0xgasc/convoca
cd convoca
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Anthropic
ANTHROPIC_API_KEY=

# Database (Railway Postgres or any Postgres)
DATABASE_URL=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Voyage AI (embeddings for dedup)
VOYAGE_API_KEY=

# Resend (email notifications)
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database setup

Run the schema against your Postgres instance:

```bash
# Apply schema + seed cities
psql $DATABASE_URL < schema.sql
```

Or paste `schema.sql` into your Railway/Supabase SQL editor and run it.

### 4. Seed data

```bash
# Load ~80 NYC sources (borough-by-borough) + Guatemala City sources
npm run seed:sources

# Seed demo events for local dev
npm run seed:demo

# Optional: seed a test user session
npm run seed:test-user
```

### 5. Run

```bash
npm run dev
# → http://localhost:3000
```

### Test the vision extractor

```bash
npm run test:vision
# runs against fixtures in scripts/fixtures/
```

---

## Features

| Feature | Status |
|---|---|
| **Event list** — default view, inline search + date pills + sort + filter | ✅ Live |
| **Map view** — Mapbox pins with flag overlays, borough filter | ✅ Live |
| **Agent chat** — SSE-streaming 7-agent orchestration | ✅ Live |
| **Submit a flyer** — drag-and-drop or camera, HEIC/iPhone support, Arweave storage | ✅ Live |
| **Community flags** — ICE presence, route change, medical aid, etc. with safety review | ✅ Live |
| **Email notifications** — 24h reminders, weekly digest, election alerts (Resend) | ✅ Live |
| **Bilingual** — English + Spanish throughout, including agent prompts | ✅ Live |
| **Admin panel** — harvest triggers, agent stats, geocode repair | ✅ Live |

---

## What Convoca ingests (and what it won't)

**In scope** — IRL events that build community: protests, town halls, mutual aid distributions, volunteer cleanups, free public programs, skill-shares, community markets, block parties.

**Out of scope** — ticketed concerts, paid classes, commercial pop-ups, anything where the frame is consumption rather than participation.

**We never scrape** Instagram, Facebook, or any logged-in platform. The path for IG-only content is `/submit` — a community member shares the URL or screenshot, and the vision agent handles it from there.

Full ingestion philosophy: [`INGESTION.md`](./INGESTION.md).

---

## Contributing

This is hackathon-stage, built in 48 hours. Seams are showing. Pull requests are welcome for:

- **Source adapters** — add your city's open data feeds, org calendars, public Telegram channels
- **Prompt improvements** — vision extractor and dedup agent especially; please include before/after flyer examples
- **Translations** — UI is en/es to start; the architecture supports any language
- **New cities** — one `cities` row + a set of `sources` rows is all it takes; open an issue to coordinate
- **Bug reports** — flyers the vision extractor gets wrong (attach the flyer)

Issues and discussions are open. This project exists because human-curated civic aggregators prove the demand but can't scale alone. The goal is to build infrastructure that amplifies that work, not replaces it.

Shoutout to the people running mutualaid.nyc, actions.nyc, protest.one, handsoffnyc, theskint, The Indypendent, nyc-noise, and BetaNYC — years of volunteer labor that makes this possible.

---

## License

MIT. AGPL under consideration for the safety/community-flagging modules specifically.
