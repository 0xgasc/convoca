// scripts/test-vision.ts
// CLI test harness for the vision extractor agent.
//
// Usage:
//   npm run test:vision <image-path-or-url> [nyc|guatemala_city]
//
// Examples:
//   npm run test:vision ./public/seed-flyers/flyer1.png
//   npm run test:vision ./public/seed-flyers/flyer2.jpg guatemala_city
//   npm run test:vision https://example.com/flyer.jpg

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { runVisionExtractor } from '../lib/agents/visionExtractor';

type SupportedMedia = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const MEDIA_TYPE_MAP: Record<string, SupportedMedia> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

async function main() {
  const [, , arg, cityArg] = process.argv;

  if (!arg) {
    console.error('Usage: npm run test:vision <image-path-or-url> [nyc|guatemala_city]');
    console.error('');
    console.error('Examples:');
    console.error('  npm run test:vision ./public/seed-flyers/flyer1.png');
    console.error('  npm run test:vision ./public/seed-flyers/flyer2.jpg guatemala_city');
    process.exit(1);
  }

  const city = (cityArg === 'guatemala_city' ? 'guatemala_city' : 'nyc') as 'nyc' | 'guatemala_city';
  const sessionId = `test-${Date.now()}`;
  const currentDate = new Date().toISOString().split('T')[0];

  console.log('\n[ vision extractor test ]');
  console.log(`  input : ${arg}`);
  console.log(`  city  : ${city}`);
  console.log(`  date  : ${currentDate}`);
  console.log('');

  const t0 = Date.now();
  let result;

  if (arg.startsWith('http://') || arg.startsWith('https://')) {
    result = await runVisionExtractor({
      imageUrl: arg,
      city,
      currentDate,
      sessionId,
    });
  } else {
    const absPath = path.resolve(arg);
    if (!fs.existsSync(absPath)) {
      console.error(`File not found: ${absPath}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(absPath).toLowerCase();
    const mediaType = MEDIA_TYPE_MAP[ext] ?? 'image/jpeg';
    result = await runVisionExtractor({
      imageBuffer: buf,
      imageMediaType: mediaType,
      city,
      currentDate,
      sessionId,
    });
  }

  const elapsed = Date.now() - t0;

  if (!result) {
    console.error('FAIL — extraction returned null (check logs above)');
    process.exit(1);
  }

  if (!result.is_event) {
    console.log(`NOT AN EVENT (${elapsed}ms)`);
    console.log(`  confidence_notes: ${result.confidence_notes}`);
    process.exit(0);
  }

  console.log(`OK — ${elapsed}ms\n`);
  console.log(`  title       : ${result.title}`);
  console.log(`  type        : ${result.event_type} / ${result.action_type}`);
  console.log(`  date        : ${result.datetime_text_raw}`);
  console.log(`  date_iso    : ${result.datetime_iso ?? '—'}`);
  console.log(`  location    : ${result.location_text} [${result.location_specificity}]`);
  console.log(`  organizer   : ${result.organizer ?? '—'}`);
  console.log(`  causes      : ${result.cause_tags.join(', ')}`);
  console.log(`  language    : ${result.language}`);
  console.log(`  confidence  : ${result.confidence.toFixed(2)}`);
  console.log(`  conf_notes  : ${result.confidence_notes}`);
  if (result.signup_url)          console.log(`  signup_url  : ${result.signup_url}`);
  if (result.supplies_needed?.length) console.log(`  supplies    : ${result.supplies_needed.join(', ')}`);
  if ((result as { lat?: number }).lat) {
    console.log(`  geocoded    : ${(result as { lat?: number }).lat}, ${(result as { lng?: number }).lng}`);
  }

  console.log('\n--- full JSON ---');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
