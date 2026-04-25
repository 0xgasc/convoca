# Convoca

> Open-source, agent-powered discovery layer for IRL events that build community — protests, town halls, mutual aid distributions, volunteer cleanups, free public programs. Launching in NYC and Guatemala City.

**Status**: hackathon MVP, in active development. Not production-ready.

## What it is

Civic and community life generates enormous amounts of organized IRL activity, but the information about it is scattered across Instagram, Telegram, Eventbrite, Mobilize, neighborhood listservs, RSS feeds, government calendars, and physical flyers. People who care actively miss things they would have shown up for.

Convoca uses Claude Opus 4.7 agents to do the cross-platform work: discovery, vision OCR on flyers, semantic deduplication across sources, ranked recommendations with visible reasoning. Plus a hyperlocal community safety overlay so attendees keep each other informed in real time.

## Three principles

**Community-fed, agent-amplified.** We pull only from sources that publish openly (public APIs, RSS, ICS, Telegram public channels, city open data) or that community members hand us via `/submit`. We do not scrape Instagram, Facebook, or any logged-in platform.

**Agents do labor, not surveillance.** No user profiling. No attendance lists. No social graphs. No persistent identity. The platform is session-based by design.

**The community is the source.** The most powerful ingest channel is one tap from a community member. Drag a flyer, paste a URL — the vision agent extracts structured data within seconds and adds it to the map.

Read the full ingestion philosophy in [`INGESTION.md`](./INGESTION.md).

## What you can do with it

- Search civic and community events across a city in natural language ("find housing actions this weekend", "encuentra eventos de vivienda este finde")
- See events on a hyperlocal map with reasoning traces explaining each recommendation
- One-tap signup via deep-links to the organizer's existing form (Mobilize, Action Network, etc.)
- Drop community safety flags in real time (police presence, ICE presence, route changes, medical aid stations, supplies needed)
- Submit flyers from any source — the vision agent processes them in seconds

## What it doesn't do

- Aggregate ticketed concerts, paid classes, or commercial entertainment
- Build user profiles or attendance data
- Scrape Instagram or Facebook
- Replace the human-curated aggregators it admires (mutualaid.nyc, actions.nyc, protest.one, The Skint, The Indypendent, BetaNYC)

## Tech stack

- Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + pgvector + storage)
- Mapbox GL JS
- Anthropic SDK (Opus 4.7 + Haiku 4.5)
- Voyage AI embeddings for dedup shortlist

## Quick start

```bash
git clone https://github.com/yourname/convoca && cd convoca
cp .env.example .env  # fill in keys
npm install
# In Supabase SQL editor, paste and run schema.sql
npm run seed:sources  # loads NYC + Guate sources
npm run dev
```

See [`INSTALL.md`](./INSTALL.md) for full setup instructions.

## Architecture

Seven agents under one orchestrator that streams its work via SSE to a live trace UI:

- **Intent Parse** — turns free-text user prompts into structured filters
- **Discovery** — snowballs new civic-relevant sources from seeds
- **Harvester** — typed adapters for each source kind (RSS, ICS, Mobilize, NYC Open Data, Legistar, public Telegram, community submissions)
- **Vision Extractor** — OCRs and structures bilingual flyers
- **Dedup** — cross-source semantic merge with visible reasoning trace
- **Recommender** — ranks events for users with one-sentence reasoning per item
- **Safety Review** — filters community safety flag submissions before they go public

All seven prompts live in a single file (`lib/agents/prompts.ts`) — intentionally centralized for fast iteration.

## Project status & contributing

This is hackathon-stage. Lots of seams exposed. Issues and PRs welcome on:

- Adding source adapters for your city
- Translating the interface
- Improving agent prompts (please include before/after examples)
- Reporting flyers the vision extractor handles badly (with the flyer attached)

Roadmap items include push notifications, organizer-side dashboards, organizer verification, federation between city instances, and a more detailed published threat model.

## License

MIT (with AGPL on the safety/community-flagging modules under consideration).

## Acknowledgments

Convoca is built on top of years of volunteer labor by the people who run the existing civic-information infrastructure. Particular gratitude to mutualaid.nyc, actions.nyc, protest.one, handsoffnyc, theskint, The Indypendent, nyc-noise, BetaNYC, and the dozens of borough-level mutual aid networks that prove every day that this work matters and is possible.
