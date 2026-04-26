# Convoca — Deployment Status

> Updated 2026-04-25 — fully shipped on Railway, no Supabase.

## 🚀 Live

- **Site**: https://convoca-web-production.up.railway.app
- **Admin**: https://convoca-web-production.up.railway.app/admin?key=m_9DoNGnJnEV7Y8nZjygy6XdbRuZDFZO  
  (the key prefills + persists to localStorage; bookmark `/admin` after first load)
- **Repo**: https://github.com/0xgasc/convoca (private)
- **Railway project**: https://railway.com/project/5cd66f06-1c2d-48f1-a345-0ec54bc7c702

## Architecture

```
                Browser (Mapbox GL + AgentTrace SSE + EventModal + Schedule panel)
                          │
                Railway: convoca-web (Next.js 14)
                          │
              Railway: Postgres 16 + pgvector
                          │
           Anthropic API (Opus 4.7 + Haiku 4.5)
                          │
          Resend (optional, for magic-link sign-in)
                          │
     Cloudflare Turnstile (optional, for bot-check on /submit)
```

- **Database**: Railway Postgres with pgvector extension. Schema managed by Prisma 6.
- **No Supabase.** Image submissions are processed in memory by the vision agent and discarded; only the URL is stored when a user submits a link.
- **No separate file storage.** Submitted flyer images live only as long as the API request that processes them.

## What's wired

| Service | Status | Env var |
|---|---|---|
| Postgres (Railway) | ✓ live, schema pushed via `prisma db push` | `DATABASE_URL` |
| Web app (Railway) | ✓ live, public domain generated | — |
| Anthropic API | ✓ key in Railway env | `ANTHROPIC_API_KEY` |
| Mapbox tiles + geocoding | ✓ public token in env | `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAPBOX_TOKEN` |
| Admin gate | ✓ enabled | `ADMIN_KEY` |
| GitHub | ✓ private repo, auto-pushed | — |
| Resend magic-link sign-in | ⚠ falls back to **auto-verify** if not set | `RESEND_API_KEY`, `RESEND_FROM` |
| Cloudflare Turnstile | ⚠ no-op if not set | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Voyage AI embeddings | ⚠ optional, dedup uses recent-window heuristic | `VOYAGE_API_KEY` |
| Cron-driven harvest | ⚠ manual via admin button until `CRON_SECRET` + external scheduler set | `CRON_SECRET` |

## Seeded content

| Table | Count | Source |
|---|---|---|
| `cities` | 2 | nyc, guatemala_city |
| `flag_type_config` | 12 | seeded by `npm run seed:demo`-ish path |
| `sources` | 40 | `npm run seed:sources` (NYC + Guate) |
| `events` | 17 | `npm run seed:demo` (12 NYC + 3-source dedup trio + 2 Guate) |
| `event_flags` | 10 | also from `seed:demo` |

Both seed scripts are idempotent — `seed:demo` wipes prior `[DEMO]` rows first.

## Agents (10 in production)

| Agent | Model | Triggered by | Where |
|---|---|---|---|
| **intent_parse** | Opus 4.7 | every chat prompt | every orchestrator run |
| **discovery** | Opus 4.7 | (skipped by default) | orchestrator with `skipDiscovery: false` |
| **harvester** | Haiku 4.5 (triage classifier per post) | "Pull fresh events" button in chat panel (public, rate-limited) OR `/admin` Run harvester button OR `/api/harvest` POST with `X-Cron-Secret` header | scrapes seeded RSS / Mobilize / NYC Open Data / Legistar feeds in parallel with per-source 12s timeout |
| **vision_extractor** | Opus 4.7 (vision) | flyer drop on `/submit`, chat orchestrator iterating over `raw_posts`, OR admin "Process queue" button | `/api/submit`, `/api/orchestrate`, `/api/process-queue` |
| **dedup** | Opus 4.7 | inside the orchestrator after vision | `/api/orchestrate` |
| **recommender** | Opus 4.7 | inside the orchestrator after dedup (default branch) | `/api/orchestrate` |
| **curator** | Opus 4.7 | "Curate" button → reads prefs + saves + passes, returns card stack with per-event "why this for you" | `/api/curate` |
| **scheduler** | Opus 4.7 | "plan my Saturday" / "schedule" / "agenda" / "itinerary" keywords in chat (orchestrator routes here instead of recommender), OR Schedule panel "Plan" button | `/api/orchestrate`, `/api/schedule` |
| **safety_review** | Opus 4.7 | every flag submit + every comment | `/api/flags`, `/api/events/[id]/comments` |
| **submission_audit** | Haiku 4.5 (+ hard rules) | every `/submit` BEFORE vision_extractor; rejects flagged LE domains, routes `.gov`/`.mil`/URL-shorteners to review, LLM-judges entrapment / astroturf / disinfo | `/api/submit` |

Every run is logged to `agent_runs` with input/output summary + reasoning trace + duration. Visible at `/admin`.

## Re-deploy

```bash
cd /Users/gs/convoca
git push                 # commit anything you want first
railway up --detach      # uploads local source, builds, deploys
```

If `railway status` shows the wrong project, re-link:

```bash
railway link --project 5cd66f06-1c2d-48f1-a345-0ec54bc7c702 \
              --service convoca-web --environment production
```

To update an env var:

```bash
railway variable set "RESEND_API_KEY=re_..." -s convoca-web
```

To stream logs:

```bash
railway logs -s convoca-web
```

## Re-seed

```bash
npm run seed:sources    # 40 sources (idempotent)
npm run seed:demo       # 17 events + 10 flags (wipes prior [DEMO] rows first)
```

Both scripts read `DATABASE_URL` from `.env.local` (Railway public proxy).

## Local dev

```bash
cd /Users/gs/convoca
npm run dev      # localhost:3000
```

`.env.local` already contains live Anthropic + Mapbox keys + Railway Postgres `DATABASE_URL` (public proxy). It is gitignored.

## Demo video

See [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the 3-minute script (7 scenes, voiceover lines, on-screen cues).

```bash
cd remotion
npm install              # ~150 MB on first install
npm run preview          # Remotion Studio at localhost:3000
npm run build            # renders to out/convoca-demo.mp4
```

Drop a 180-second voiceover MP3 at `remotion/public/voiceover.mp3` and uncomment the `<Audio>` line in `src/compositions/MainSequence.tsx` to bake it in.

## How users trigger agents

| Action on the site | Agent(s) fire |
|---|---|
| Click **Pull fresh events** in chat sidebar | `harvester` (parallel, 6 sources at a time, 12s per-source timeout) |
| Type any prompt in chat | `intent_parse` (always) → `vision_extractor` (if unprocessed `raw_posts` with images) → `dedup` → `recommender` |
| Type "plan my Saturday" / "agenda" / "itinerary" / "build my day" | `intent_parse` → `scheduler` (over saved events) |
| Click **Curate** in header | `curator` (reads prefs + saves + passes; returns card stack) |
| Save / Pass / Maybe on a curate card | writes `event_saves` or `event_passes` (no agent — feedback for next curate) |
| Click **Plan** in Schedule panel | `scheduler` |
| Drop a flyer at `/submit` | `submission_audit` (Haiku) → `vision_extractor` (Opus, only if audit returns `process`) |
| Click map / event "Add a flag" → submit | `safety_review` |
| Post a comment on an event | `safety_review` |
| Admin "Run harvester" | `harvester` |
| Admin "Process queue" | `vision_extractor` on up to 6 pending raw_posts |

## What's deliberately missing

- **Persistent flyer image storage** — dropped. Add Cloudflare R2 if needed; we already store `source_image_url` on `events` for URL submissions.
- **Hardened harvester adapters** — RSS, ICS, Mobilize, NYC Open Data, Legistar work but use minimal parsers; `telegram_public`, `eventbrite_api`, `website_scrape` are stubs.
- **Vision extractor iteration** — highest-leverage prompt; needs real flyer fixtures for `npm run test:vision` (script not yet written).
- **Voyage AI embeddings for dedup** — heuristic shortlist works at hackathon scale.

## Roadmap

| Item | Status |
|---|---|
| Saved events + per-user schedule | ✓ shipped (modal + Scheduler agent) |
| Comments per event with Safety Review | ✓ shipped |
| Sign-in required to flag / comment | ✓ shipped (Resend magic-link with auto-verify fallback) |
| Cloudflare Turnstile bot check on submit | ✓ wired, just needs keys |
| Manual harvest trigger | ✓ shipped (chat sidebar button + admin button + `/api/harvest`) |
| Parallel harvester with per-source timeout | ✓ shipped (6× concurrency, 12s timeout, marks polled even on failure) |
| Submission audit (state-actor / entrapment) | ✓ shipped (Haiku + hard rules) |
| Curator agent (pre-fill watchlist) | ✓ shipped (`/api/curate`, card-stack UI) |
| Process-queue button (run vision on harvested posts) | ✓ shipped (admin only) |
| Confirm-flag / "I see this too" button | ⚠ API exists at `/api/flags/[id]/confirm`; no UI yet |
| Public "agents running right now" counter | not started |
| Cron'd harvest every 30 min | not started — set `CRON_SECRET` and use [cron-job.org](https://cron-job.org) to hit `/api/harvest` with the header |
| First-visit Curator auto-trigger after onboarding | not started |

## Open decisions

- **Make repo public?** Currently private. CLAUDE.md says "Public repo from day one." Flip with: `gh repo edit 0xgasc/convoca --visibility public`
- **Custom domain** (e.g. `convoca.app`)? Add to Railway with `railway domain --custom your.domain`.
- **Add `RESEND_API_KEY`** to upgrade auto-verify sign-in to real magic links.
- **Add `TURNSTILE_*` keys** to enable real bot-check on `/submit`.

## Files at a glance

| Path | Purpose |
|---|---|
| [`prisma/schema.prisma`](./prisma/schema.prisma) | Source of truth for DB schema (10 models incl. EventSave, EventComment) |
| [`lib/db.ts`](./lib/db.ts) | Prisma client singleton |
| [`lib/auth.ts`](./lib/auth.ts) | Session-based identity + magic-link helpers |
| [`lib/turnstile.ts`](./lib/turnstile.ts) | Cloudflare Turnstile verification (no-op without keys) |
| [`lib/icons.ts`](./lib/icons.ts) | Lucide icon registry for event_type / flag_type / agent_name |
| [`lib/agents/`](./lib/agents/) | The 8 agents + traces |
| [`scripts/seed-nyc-sources.ts`](./scripts/seed-nyc-sources.ts) | Source registry seeder |
| [`scripts/seed-demo-events.ts`](./scripts/seed-demo-events.ts) | Demo events + flags seeder |
| [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) | 3-min video script with voiceover lines |
| [`remotion/`](./remotion/) | Separate Node project for the demo video (Remotion compositions) |
| [`.env.local`](./.env.local) | Local env (Anthropic + Mapbox + DATABASE_URL), gitignored |
