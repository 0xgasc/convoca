# Convoca — Next Chat Starter

> Working dir: /Users/gs/convoca
> Repo: https://github.com/0xgasc/convoca
> Hackathon deadline: 2026-04-26 20:00 EST
> Today: 2026-04-26

## What's Done ✅

All core features shipped and pushed to main:

- **List view default** — inline search, date pills, sort, filter button, improved event cards
- **Map view** — Mapbox pins, borough overlay, flag overlays
- **7-agent orchestration** — orchestrator → intent parse → harvester → vision → dedup → recommender → safety review, SSE streaming
- **Community flags** — submit → safety review agent → live overlay on map
- **Submit flyer** — Stash/Arweave TUS upload, HEIC→JPEG canvas conversion, appeal flow
- **Email notifications** — event reminders (24h), weekly digest, election alerts via Resend
- **Onboarding** — city + notify step, cause prefs
- **Admin panel** — agent stats, warm-all-agents, harvest/process/geocode actions
- **Clean event detail** — formatDatetimeDisplay (no raw ISO), ReasoningTrace human-friendly
- **Bilingual** — en/es throughout
- **Test user** — session `demo-gsc-convoca`, email gasolomonc@gmail.com

## What Could Still Be Done (priority order)

### Demo-critical
1. **Run "Fix pins"** in admin after deploy — geocoding still imperfect for vague venues
2. **Seed fresh events** — harvest has been running but verify events load on prod
3. **Submit a real flag** to confirm safety_review agent fires and shows in admin

### Nice-to-have before demo
4. **Map → List transition** — clicking a pin could open event in the list view below
5. **Highlight in list** when agent returns results — autoscroll to first highlighted event
6. **Mobile list header** — show "Convoca · NYC" branding somewhere in list mode (header area feels bare on phone)
7. **Save button in list row** — currently only in event modal

### Post-demo roadmap
- Cross-device session sync (look up sessions by email on sign-in)
- Enable Discovery agent (currently skipDiscovery=true)
- Instagram URL submission (currently blocked by bot detection)
- Push notifications (Web Push API)

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Main page — all state, view toggle, filter logic |
| `components/Events/EventListView.tsx` | List view with toolbar (recently redesigned) |
| `components/Map/MapView.tsx` | Mapbox map |
| `components/EventDetail/EventModal.tsx` | Event detail modal |
| `components/Submit/DropZone.tsx` | Flyer upload (Stash TUS + HEIC→JPEG) |
| `lib/agents/` | All 7 agents + prompts.ts |
| `lib/email.ts` | Resend email helpers |
| `app/api/cron/notify/route.ts` | Email notification cron handler |
| `app/admin/page.tsx` | Admin dashboard |
| `scripts/seed-test-user.ts` | Creates demo session (npm run seed:test-user) |

## To Start a Demo Session in Browser
```js
localStorage.setItem('convoca_session_id', 'demo-gsc-convoca')
// Then refresh — you'll be signed in as gasolomonc@gmail.com
```

## Stash API Status
TUS endpoint https://stash-production-47fc.up.railway.app/tus-upload → 204 ✅ healthy
