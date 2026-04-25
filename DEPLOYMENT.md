# Convoca — Deployment Status

> Updated 2026-04-25 — fully shipped on Railway, no Supabase.

## 🚀 Live

- **Site**: https://convoca-web-production.up.railway.app
- **Admin**: https://convoca-web-production.up.railway.app/admin?key=m_9DoNGnJnEV7Y8nZjygy6XdbRuZDFZO  
  (the key prefills + persists to localStorage; bookmark `/admin` after first load)
- **Repo**: https://github.com/0xgasc/convoca (private)
- **Railway project**: https://railway.com/project/5cd66f06-1c2d-48f1-a345-0ec54bc7c702

## Architecture (final)

```
                Browser (Mapbox GL + AgentTrace SSE)
                          │
                Railway: convoca-web (Next.js 14)
                          │
              Railway: Postgres 16 + pgvector
                          │
           Anthropic API (Opus 4.7 + Haiku 4.5)
```

- **Database**: Railway Postgres with pgvector extension. Schema managed by Prisma 6.
- **No Supabase.** Image submissions are processed in memory by the vision agent and discarded; only the URL is stored when a user submits a link.
- **No separate file storage.** Submitted flyer images live only as long as the API request that processes them.

## What's wired

| Service | Status |
|---|---|
| Postgres (Railway) | ✓ live, schema pushed via `prisma db push`, 40 sources + 12 flag types + 2 cities seeded |
| Web app (Railway) | ✓ live, public domain generated, build green |
| Anthropic API | ✓ key in Railway env |
| Mapbox | ✓ public token in Railway env (NEXT_PUBLIC + server-side) |
| GitHub | ✓ private repo, auto-pushed |
| Voyage AI (embeddings) | ✗ optional — dedup currently uses recent-window heuristic, not embeddings |

## Re-deploy

```bash
cd /Users/gs/convoca
git push                 # commit anything you want first
railway up --detach      # uploads local source, builds, deploys
```

Railway environment vars are persistent. To update one:

```bash
railway variables -s convoca-web --set "ANTHROPIC_API_KEY=sk-ant-..."
```

To stream logs:

```bash
railway logs -s convoca-web
```

## Re-seed

```bash
npm run seed:sources    # 40 sources (idempotent)
npm run seed:demo       # 17 demo events + 10 flags (wipes prior [DEMO] rows first)
```

Both scripts read `DATABASE_URL` from `.env.local` (Railway public proxy).

## Local dev

```bash
cd /Users/gs/convoca
npm run dev      # localhost:3000
```

`.env.local` already contains live Anthropic + Mapbox keys + Railway Postgres `DATABASE_URL` (public proxy). It is gitignored.

## What's deliberately missing

- **Persistent flyer image storage**: dropped. If you later want a flyer gallery on the event detail page, bolt on Cloudflare R2 (or just keep the `source_image_url` URL we already store on `events`).
- **Voyage AI embeddings for dedup**: dedup currently uses a city + recent-hours window heuristic before judging with Opus. Embedding-based shortlist is a one-day add when needed.
- **Hardened harvester adapters**: RSS, ICS, Mobilize, NYC Open Data, and Legistar adapters work but use minimal parsers. `telegram_public`, `eventbrite_api`, `website_scrape` are stubs.
- **Vision extractor iteration**: per CLAUDE.md, this is the highest-leverage prompt — plan to spend a third of remaining time on `VISION_PROMPT` in [`lib/agents/prompts.ts`](./lib/agents/prompts.ts) using real flyer fixtures.

## Roadmap (post-MVP, surfaced from user feedback)

| Item | Why | Sketch |
|---|---|---|
| Real bot/human verification on `/submit` | Current rate limit (10/session/h, 30/IP/h) blocks naive abuse but not a determined attacker. | Drop in **Cloudflare Turnstile** (free, no Personal Data) on the DropZone — verify token in `/api/submit`. ~1 hour. |
| Per-event comments / discussion thread | Several user requests; lets attendees coordinate inside the event page. | New `event_comments` Prisma model + a `Comments` client component on `/events/[id]`. Pipe each new comment through Safety Review like flags. ~3 hours. |
| Confirm-flag / "I see this too" UI | API exists at `/api/flags/[id]/confirm` but no button surfaces it yet. | Add a button on the FlagOverlay popup. ~30 min. |
| Sign-in (light) | So community-trusted reporters get higher trust on flags + comments. | Magic-link via Resend → `user_sessions` row keyed by email hash, no profile. |
| Public agent-runs view | The `/admin` page is gated; non-admins should still see "X agents running right now" as social proof. | Read-only counts at `/api/public/agent-stats`. |
| Vision extractor seed flyers | The dedup wow is hand-crafted right now. Real flyers from `/public/seed-flyers/` + `npm run test:vision` to iterate `VISION_PROMPT`. |

## Open decisions

- **Make repo public?** Currently private. CLAUDE.md says "Public repo from day one." Flip with: `gh repo edit 0xgasc/convoca --visibility public`
- **Custom domain** (e.g. `convoca.app`)? Add to Railway with `railway domain --custom your.domain` after pointing DNS to the auto-generated Railway domain.

## Files at a glance

| Path | Purpose |
|---|---|
| [`prisma/schema.prisma`](./prisma/schema.prisma) | Source of truth for DB schema |
| [`lib/db.ts`](./lib/db.ts) | Prisma client singleton |
| [`lib/agents/`](./lib/agents/) | The 7 agents + traces |
| [`scripts/seed-nyc-sources.ts`](./scripts/seed-nyc-sources.ts) | Source registry seeder |
| [`schema.sql`](./schema.sql) | Original Supabase-flavored SQL — **kept for reference only**, not the source of truth |
| [`.env.local`](./.env.local) | Local env (Anthropic + Mapbox + DATABASE_URL), gitignored |
