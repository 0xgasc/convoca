# Convoca — Deployment Status

> Updated 2026-04-25 — fully shipped on Railway, no Supabase.

## 🚀 Live

- **URL**: https://convoca-web-production.up.railway.app
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

## Re-seed sources

The seed script reads `.env.local` for `DATABASE_URL` (the public proxy URL).

```bash
npm run seed:sources
```

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
