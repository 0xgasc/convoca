# Convoca — 3-minute demo script

**Run time**: 180 seconds. Each scene maps 1:1 to a Remotion composition in [`remotion/src/compositions/`](./remotion/src/compositions/).

Voiceover lines are tight (avg 150 wpm). Cues in *italics* are on-screen actions. The remotion column is the composition that should be on screen at that moment.

---

## Scene 1 — Hook (0:00 – 0:22)

**Remotion**: `Hook` — black background, large typography fades up. Stat counter animates from 0 → 200 ("organized events last weekend") → 8 ("the average New Yorker heard about").

> "Last weekend in New York City, more than two hundred organized civic events happened. Protests. Mutual aid distributions. Free concerts. Town halls. Volunteer cleanups. Library readings. The average New Yorker who actively cares heard about maybe eight of them."

> "Civic and community life is broken at the discovery layer. Convoca is an open-source agent platform that fixes it, powered by Claude Opus 4.7."

---

## Scene 2 — One prompt, six agents (0:22 – 0:55)

**Remotion**: `Prompt` — Convoca map UI screencap; chat panel highlighted on the right. Agent badges at the top of the chat panel light up one by one as the orchestrator fires them.

*Type live in the chat panel*: `housing actions this weekend in Brooklyn, attend or volunteer`

> "One natural-language prompt. Six agents kick off in parallel. Intent parse already understood I want to attend or volunteer. Vision extracts data from new flyers. Dedup merges duplicates across sources. Recommender ranks for me with reasoning I can read."

*Agent badges turn green one by one. Pins on the map glow amber for the recommended events.*

---

## Scene 3 — Vision on a real flyer (0:55 – 1:30)

**Remotion**: `Vision` — split screen. Left: a real bilingual IG flyer (PNG). Right: streaming JSON output appearing key by key.

*Drag a fresh bilingual flyer screenshot onto the map.*

> "Anyone in this audience can submit a flyer right now. Drag, drop. The vision agent reads it — bilingual flyer, hand-designed, screenshot of an IG story. It extracts title, datetime, organizer, cause tags, action type, language."

*Pin lands on the map. Confidence number appears: 0.91.*

> "Confidence point nine one. Pin is on the map. End-to-end in eight seconds."

---

## Scene 4 — Dedup with visible reasoning (1:30 – 2:05)

**Remotion**: `Dedup` — three IG-style flyer cards on the left, each from a different org, all describing the same Sunday food distribution. They animate inward and merge into one card. The dedup agent's reasoning trace types out below.

*Click the "3 sources" badge on the Sunset Park food distribution.*

> "Five different orgs posted this same Saturday food distribution. Different platforms. Different wording. Different languages. Watch the agent reason."

*Reasoning trace expands*:
1. Same parish — Maria Hernandez Park.
2. Datetimes within 30 minutes.
3. Organizers in known coalition.

> "Merged at point nine four confidence. Cross-source semantic judgment. Only possible with a reasoning model, and the user sees the reasoning."

---

## Scene 5 — Curator + agent-built schedule (2:05 – 2:30)

**Remotion**: `Schedule` — left half: a card stack with three events flicking through, each with a "why this for you" caption from the Curator agent; chosen ones fly into the right half where the Scheduler lays out a Saturday itinerary with travel chips.

*Click "Curate" in the header. The Curator agent surfaces 12 cards based on saved causes + neighborhood. Tap Save on three. Open Schedule → "plan my Saturday".*

> "Convoca has a personal curator. It reads my onboarding causes, my neighborhood, every event I've saved or passed before, and pre-fills a watchlist. One sentence per card explaining why it's for me — and the cards I pass on are negative signal for next time."

*Three events get saved. Cut to the schedule view.*

> "Then the scheduler takes my saves and builds a Saturday — respecting start times, clustering by neighborhood, flagging conflicts. Curate, save, schedule. The whole personalization journey, three agents."

---

## Scene 6 — One-tap action + community safety (2:30 – 2:55)

**Remotion**: `Action` — phone-style frame. RSVP button turns green and deep-links to Mobilize. Then the map view: a 'medical_aid' flag drops with an agent badge ("Safety Review — approved 0.6s") appearing beside it.

*Tap the RSVP button on an event.*

> "One tap from discovery to action. Deep-links to the organizer's existing form."

*Drop a medical_aid flag on the map.*

> "And because events are dynamic, attendees flag what they see in real time. Each flag goes through a Safety Review agent that filters spam and doxxing but errs toward approval — real-time info matters when you're on the ground."

---

## Scene 7 — Close (2:55 – 3:00)

**Remotion**: `Close` — Convoca wordmark on white. Three lines below it.

> "Open source. Community-fed. Agent-amplified. Convoca."

---

## Production notes

### Voiceover

- ~410 words total. Aim for natural pace; ~150 wpm. Allow ~2-3s of room tone between scenes.
- Suggested voice services:
  - **ElevenLabs** (best quality, paid) — suggested voice "Adam" or "Bella"
  - **OpenAI TTS-1-HD** (cheap, good)
  - macOS `say -v Samantha -o voice.aiff` (free, demo-only quality)

### Audio + video assembly

```bash
cd remotion
npm install
npm run preview                # opens Remotion Studio
npm run build                  # renders to out/convoca-demo.mp4
```

`remotion/src/Root.tsx` registers all 7 compositions with their start/end frames. To stitch into one continuous video, render `MainSequence` (defined in `Root.tsx`) which embeds all 7 in order.

### Asset checklist

- [ ] 1 bilingual real flyer in `remotion/public/flyer.png`
- [ ] 3 distinct flyer thumbnails for the dedup scene in `remotion/public/dedup/`
- [ ] Convoca wordmark SVG in `remotion/public/wordmark.svg`
- [ ] Voiceover MP3/WAV in `remotion/public/voiceover.mp3` (single file, 180s, scene cuts marked at the timestamps above)
- [ ] Optional: ambient music bed at -24 LUFS
