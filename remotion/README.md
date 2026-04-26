# Convoca demo video — Remotion

A separate Node project (no shared deps with the main Convoca app). Renders the 3-minute demo described in [`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md).

## Setup

```bash
cd remotion
npm install
```

Remotion will pull a Chromium binary on first install (~150 MB). Allow it to.

## Preview interactively

```bash
npm run preview
```

Opens [Remotion Studio](https://www.remotion.dev/docs/studio) at http://localhost:3000. Pick `MainSequence` from the left sidebar to see the full 3-minute reel, or pick any individual scene (`Hook`, `Prompt`, `Vision`, `Dedup`, `Schedule`, `Action`, `Close`) to iterate.

## Render to MP4

```bash
npm run build                # MainSequence (full 180s) → out/convoca-demo.mp4
npm run build:scene Hook out/hook.mp4    # render one scene only
```

## Adding voiceover

1. Record / generate a single 180-second MP3 of the voiceover from `DEMO_SCRIPT.md`. Suggested tools:
   - [ElevenLabs](https://elevenlabs.io) (best, paid)
   - [OpenAI TTS-1-HD](https://platform.openai.com/docs/guides/text-to-speech) (cheap)
   - macOS `say -v Samantha -o voice.aiff` (free, demo-only)
2. Save it as `remotion/public/voiceover.mp3`.
3. Uncomment the `<Audio>` line in [`src/compositions/MainSequence.tsx`](./src/compositions/MainSequence.tsx).
4. Re-render.

## Scene timing

Edit `SCENE_FRAMES` in [`src/Root.tsx`](./src/Root.tsx). Default budget (30fps):

| Scene    | Seconds | Frames |
|----------|---------|--------|
| Hook     | 22      | 660    |
| Prompt   | 33      | 990    |
| Vision   | 35      | 1050   |
| Dedup    | 35      | 1050   |
| Schedule | 25      | 750    |
| Action   | 25      | 750    |
| Close    |  5      | 150    |
| **Total**| **180** | **5400** |

## Asset checklist

Drop these into `public/` before final render:

- [ ] `flyer.png` — one real bilingual flyer for the Vision scene
- [ ] `dedup/source-1.png`, `source-2.png`, `source-3.png` — the three-org dedup demo
- [ ] `wordmark.svg` — Convoca wordmark for the close
- [ ] `voiceover.mp3` — 180s voiceover
- [ ] (optional) `bed.mp3` — ambient music bed

The current scenes use placeholder typography; once assets are in place, swap them into the relevant composition with `<Img src={staticFile('flyer.png')} />`.
