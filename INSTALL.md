# Convoca — Install & First Run

> Step-by-step setup for Claude Code (or any developer) to bootstrap Convoca from these starter files. Follow in order.

## Step 1: Repo bootstrap

```bash
npx create-next-app@latest convoca --typescript --tailwind --app --src-dir=false --eslint --no-import-alias
cd convoca
```

When prompted for "Use Turbopack" — your call. "Use experimental App Router" — yes. Don't import Tailwind via the @ alias prompt; we use relative `@/` paths.

## Step 2: Drop in the starter files

Copy the files from `/mnt/user-data/outputs/` into the repo at these paths:

```
convoca/
├── CLAUDE.md
├── README.md
├── INGESTION.md
├── INSTALL.md
├── nyc-sources.md
├── package.json                          ← merge with the create-next-app default
├── schema.sql
├── .env.example                          ← copy and rename to .env.local, fill in keys
├── lib/
│   ├── types.ts
│   ├── constants.ts
│   ├── supabase.ts
│   └── agents/
│       ├── prompts.ts
│       ├── orchestrator.ts
│       ├── traces.ts
│       ├── intentParse.ts
│       ├── discovery.ts
│       ├── harvester.ts
│       ├── visionExtractor.ts
│       ├── dedup.ts
│       ├── recommender.ts
│       └── safetyReview.ts
├── components/
│   └── Chat/
│       └── AgentTrace.tsx
├── app/
│   └── api/
│       ├── orchestrate/
│       │   └── route.ts                  ← orchestrate-route.ts renamed
│       └── submit/
│           └── route.ts                  ← submit-route.ts renamed
└── scripts/
    └── seed-nyc-sources.ts
```

Note: the artifact names `orchestrate-route.ts` and `submit-route.ts` should be renamed to `route.ts` inside their respective `/app/api/orchestrate/` and `/app/api/submit/` directories.

## Step 3: Install dependencies

```bash
npm install
```

If you used `create-next-app`, merge the existing `package.json` deps with the ones from the artifact.

## Step 4: Set up Supabase

1. Create a new project at https://supabase.com
2. Open the SQL editor and paste `schema.sql` — run it
3. Storage → Create a new bucket named `submissions` (public read)
4. Project Settings → API → copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

Paste those into `.env.local`.

## Step 5: Get the rest of the API keys

- **Anthropic**: https://console.anthropic.com → API keys → create new → `ANTHROPIC_API_KEY`
- **Mapbox**: https://account.mapbox.com → tokens → default public token → both `MAPBOX_TOKEN` and `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Voyage AI** (embeddings, optional for V1 dedup): https://dash.voyageai.com → keys → `VOYAGE_API_KEY`

## Step 6: Seed sources

```bash
npm run seed:sources
```

This loads ~40 NYC sources across all 5 boroughs and 2 Guate sources into the `sources` table.

## Step 7: First run

```bash
npm run dev
```

Open http://localhost:3000.

You should see an empty map. Nothing has been harvested yet.

## Step 8: Trigger the first harvest

In a separate terminal:

```bash
curl -X POST http://localhost:3000/api/harvest \
  -H "Content-Type: application/json" \
  -d '{"city":"nyc","sessionId":"test-session-1"}'
```

This polls the source registry, fetches RSS/ICS/Mobilize/NYC Open Data feeds, and triages posts via Haiku. Should take 10-30 seconds depending on source response times.

Check Supabase: `raw_posts` should now have rows with `has_event_signal: true` for the civic ones.

## Step 9: Run vision extraction on the harvested signal

The orchestrator runs vision extraction inline when a user makes a request, so just send a request:

```bash
curl -N -X POST http://localhost:3000/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What civic events are happening in Brooklyn this weekend?","sessionId":"test-session-1","city":"nyc"}'
```

Should stream SSE events back. Watch the side panel light up in the browser.

## Step 10: Test the submit flow

Open http://localhost:3000/submit, drag in a flyer image, watch it process.

Or via curl:

```bash
curl -X POST http://localhost:3000/api/submit \
  -F "image=@/path/to/flyer.jpg" \
  -F "sessionId=test-session-1" \
  -F "city=nyc"
```

## What's NOT done yet (TODO before hackathon presentation)

The starter files give you everything below the API layer, but the UI is incomplete. You still need:

1. `app/page.tsx` — the main map + chat split-screen view
2. `components/Map/MapView.tsx` — Mapbox container
3. `components/Map/EventMarkers.tsx` — markers with `event_type` icons
4. `components/Map/FlagOverlay.tsx` — live safety flags layer
5. `components/Map/FlagModal.tsx` — submit a flag UI
6. `components/Chat/ChatInput.tsx` — prompt input
7. `components/Chat/EventCard.tsx` — inline event result
8. `components/EventDetail/SignupCTA.tsx` — action_type-aware signup CTA
9. `components/EventDetail/SourcesList.tsx` — "merged from N sources" disclosure
10. `components/EventDetail/ReasoningTrace.tsx` — dedup judgment trace
11. `components/Submit/DropZone.tsx` — drag-and-drop flyer submission
12. `components/Onboarding/CausePicker.tsx` etc.
13. `app/events/[id]/page.tsx` — event detail page
14. `app/submit/page.tsx` — submission page
15. `app/about/page.tsx` — pulls from `INGESTION.md`
16. The `/api/flags`, `/api/events`, `/api/agent-runs/:session` routes

These are mechanical given the types and components above. Ask Claude Code to build them one at a time, referencing `CLAUDE.md` for architecture and `AgentTrace.tsx` as the styling/SSE pattern reference.

## Build order (for Claude Code prompt sequence)

1. "Build `app/page.tsx` as a map+chat split view. Map on the left, chat input + AgentTrace on the right. Use the AgentTrace component as-is. Look up events from `/api/events?city=nyc` to populate the map. Style minimally — Tailwind + shadcn defaults."

2. "Build the Mapbox components: `MapView`, `EventMarkers`, `FlagOverlay`. Use event_type icons from `lib/constants.ts`. Pull live flags from `/api/flags?city=nyc` and refresh every 30s."

3. "Build the event detail page at `app/events/[id]/page.tsx`. Show the event, the sources it was merged from, the dedup reasoning trace if available, and a SignupCTA that adapts to action_type."

4. "Build the submission flow: `/submit` page with drag-and-drop, status polling, and a confirmation that links to the resulting event."

5. "Build the flag submission modal triggered from any map location. Use the flag_type icons from constants. Send to `/api/flags` and reflect approval status."

6. "Build the onboarding flow: city picker → cause picker → action prefs → language toggle. Persist to `/api/sessions`. Show on first visit only."

7. "Build the about page from `INGESTION.md` content."

## Pre-demo checklist

- [ ] 30+ real NYC flyers saved to `/public/seed-flyers/` and pre-extracted
- [ ] 3 dedup demo cases hand-crafted in seed data (same event, 3 different orgs)
- [ ] 5 hand-vetted flyers held back for live demo (3 easy, 1 hard, 1 multi-language)
- [ ] 8 example community flags pre-seeded for demo realism
- [ ] Backup video recording of the full demo flow
- [ ] Verbal script rehearsed 10x
- [ ] Bilingual UI strings tested
- [ ] Phone-friendly map layout tested (judges may pull it up on phones)

## Troubleshooting

**`runVisionExtractor` returns null on every flyer** → Check `ANTHROPIC_API_KEY`, then check that the image is publicly fetchable from Supabase storage (bucket needs public read).

**Mapbox markers don't render** → Confirm `NEXT_PUBLIC_MAPBOX_TOKEN` is set and the token has `styles:read` scope.

**SSE stream cuts off mid-stream** → Vercel free tier has a 10s timeout on serverless functions. For longer agent runs, deploy to a platform with longer timeouts (Vercel Pro, Fly.io, Railway).

**Harvester finds zero posts** → RSS feeds change. Hit each `source_url` manually to confirm it returns valid XML. The included parser is minimal; for production use `rss-parser`.

**Dedup never merges anything** → For a hackathon you may want to seed events with intentional duplicates and lower the confidence threshold in `dedup.ts` (currently 0.75) to make merges happen on-stage.
