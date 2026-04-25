# Convoca — Deployment Status

> Snapshot of what is set up and what you must do to ship. Updated 2026-04-25.

## ✅ Done

- **Code**: pushed to private repo [github.com/0xgasc/convoca](https://github.com/0xgasc/convoca) on branch `main`.
- **Build**: `npm run build` passes locally. 13 routes (5 pages + 8 API routes).
- **Railway project shell**: `convoca` created on workspace `0xgasc's Projects`. Project ID `5cd66f06-1c2d-48f1-a345-0ec54bc7c702`. Dashboard: https://railway.com/project/5cd66f06-1c2d-48f1-a345-0ec54bc7c702
  - **No service is attached yet** (deliberate — see below).
- **Local env**: `.env.local` exists with placeholder values copied from `.env.example`.
- **CLIs available**:
  - `~/.local/bin/supabase` (v2.90.0, **not logged in**)
  - `railway` (logged in as gasolomonc@gmail.com)
  - `vercel` (logged in as gasolomonc-1725, fallback option)
  - `gh` (logged in as 0xgasc)

## 🟡 You must do

### 1. Create the Supabase project (5 min, dashboard)

Why dashboard not CLI: `supabase projects create` requires `SUPABASE_ACCESS_TOKEN` (generate at https://supabase.com/dashboard/account/tokens) and an org slug. Faster to click through.

1. Go to https://supabase.com → New project → name `convoca`, region closest to you.
2. SQL editor → paste contents of [`schema.sql`](./schema.sql) → Run.
3. Storage → New bucket → name `submissions`, **public read**.
4. Project Settings → API → copy the three keys you need.

### 2. Get the other API keys

- Anthropic: https://console.anthropic.com → API keys → create new
- Mapbox: https://account.mapbox.com → tokens → copy default public token
- Voyage AI: https://dash.voyageai.com → keys (optional for V1; dedup falls back to keyword match without it)

### 3. Fill `.env.local` and re-run locally to smoke-test

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=pk....
MAPBOX_TOKEN=pk....
VOYAGE_API_KEY=pa-...
```

```bash
cd /Users/gs/convoca
npm run seed:sources   # loads ~40 NYC sources + a few Guate
npm run dev
```

Open http://localhost:3000. The map should render (Mapbox token live), the agent chat panel should accept a prompt, and the home page should show the onboarding modal on first load.

### 4. Attach a Railway service and deploy

The Railway project is empty by design — attaching a service triggers builds that consume your trial credit. Run when you're ready:

```bash
cd /Users/gs/convoca

# Link the service to GitHub so every push to main auto-deploys
railway add \
  --service convoca-web \
  --repo 0xgasc/convoca \
  --variables "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
  --variables "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" \
  --variables "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --variables "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" \
  --variables "NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN" \
  --variables "MAPBOX_TOKEN=$MAPBOX_TOKEN" \
  --variables "VOYAGE_API_KEY=$VOYAGE_API_KEY"

# Generate a public domain
railway domain
```

Or, if you prefer to upload the local source directly without GitHub auto-deploy:

```bash
railway add --service convoca-web
railway up
railway domain
```

**Why Railway over Vercel**: SSE on `/api/orchestrate` runs the full multi-agent pipeline. Vercel free tier kills functions at 10s; agent runs commonly take 20–60s. INSTALL.md flags this. Vercel Pro ($20/mo) raises the limit; Railway has no equivalent cap.

## 🚧 Known gaps (not blockers for a demo, but flagged)

- **Geocoding**: `runVisionExtractor` returns `lat`/`lng` only when the flyer text contains coordinates. Add a Mapbox Geocoding API call inside the extractor before persisting events to get pins on the map for hand-typed addresses.
- **Harvester adapter coverage**: starter ships RSS + minimal ICS parsers. Mobilize, Action Network, NYC Open Data, Legistar adapters exist as stubs in `lib/agents/harvester.ts` but most need a few lines of real fetch logic each. INSTALL.md notes this.
- **Vision extractor iteration**: per CLAUDE.md, this is the highest-leverage prompt. Plan to spend a third of the remaining time on `VISION_PROMPT` in `lib/agents/prompts.ts`. Use `npm run test:vision` (script not yet written — write `scripts/test-vision.ts` that runs the extractor against fixture flyers in `public/seed-flyers/`).
- **Pre-demo seed**: hand-craft 3 dedup duplicate cases + 5 hand-vetted flyers + 8 example flags before going live. CLAUDE.md "Pre-demo checklist" section.

## 🔓 Make repo public when ready

The repo is currently private. CLAUDE.md states "Public repo from day one" — you can flip it once you've reviewed:

```bash
gh repo edit 0xgasc/convoca --visibility public
```

## Quick reference

| Thing | Where |
|---|---|
| Local code | `/Users/gs/convoca` |
| GitHub repo | https://github.com/0xgasc/convoca (private) |
| Railway project | https://railway.com/project/5cd66f06-1c2d-48f1-a345-0ec54bc7c702 |
| Supabase project | _not created yet_ |
| `.env.local` | `/Users/gs/convoca/.env.local` (placeholder values, fill in to use) |
| Schema | [`schema.sql`](./schema.sql) |
| Build order spec | [`INSTALL.md`](./INSTALL.md) — "Build order" section |
| Architecture spec | [`CLAUDE.md`](./CLAUDE.md) |
