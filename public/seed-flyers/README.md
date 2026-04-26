# Seed Flyers

Three bilingual community event flyers for testing the vision extractor and for use in the demo video.

## How to screenshot them

1. Open the dev server: `npm run dev`
2. Navigate to: `http://localhost:3000/seed-flyers/flyer1.html`
3. Set your browser window to exactly **1080 × 1080 px** (DevTools → Device toolbar → custom size)
4. Screenshot with `Cmd+Shift+4` → save as PNG

Then test:
```bash
npm run test:vision ./public/seed-flyers/flyer1.png
npm run test:vision ./public/seed-flyers/flyer2.png
npm run test:vision ./public/seed-flyers/flyer3.png guatemala_city
```

## Flyers

| File | Event | Cause | Language | Demo scene |
|------|-------|-------|----------|------------|
| flyer1.html | Sunset Park Free Food Distribution | mutual_aid | es+en | Scene 4 (dedup trio) |
| flyer2.html | Know Your Rights Workshop | immigration_rights | es+en | Scene 3 (vision wow) |
| flyer3.html | Highbridge Park Cleanup | environment | es+en | Scene 3 alternate |

## For the demo video (Scene 3)

Use **flyer2** — it has the strongest bilingual contrast (English headlines, Spanish details, QR-style element) and tests the vision agent hardest. Drag the PNG onto the map at `/`, watch the JSON stream in.
