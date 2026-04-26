// scripts/seed-test-user.ts
// Creates / updates a demo session for gasolomonc@gmail.com that is already
// verified, so the flagging + commenting flow works without going through
// the magic-link email in demos.
//
// Run with: npm run seed:test-user
//
// After running, paste this into the browser console on the Convoca site:
//   localStorage.setItem('convoca_session_id', 'demo-gsc-convoca')
// then refresh the page. You will appear signed in.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SESSION_ID = 'demo-gsc-convoca';
const EMAIL = 'gasolomonc@gmail.com';
const DISPLAY_NAME = 'Gustavo';

async function run() {
  await prisma.userSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      email: EMAIL,
      display_name: DISPLAY_NAME,
      verified_at: new Date(),
      city_slug: 'nyc',
      language: 'en',
      cause_prefs: ['housing', 'climate', 'immigration'],
    },
    update: {
      email: EMAIL,
      display_name: DISPLAY_NAME,
      verified_at: new Date(),
    },
  });

  console.log('\n✓ Test session created / updated');
  console.log(`  Session ID : ${SESSION_ID}`);
  console.log(`  Email      : ${EMAIL}`);
  console.log(`  Name       : ${DISPLAY_NAME}`);
  console.log('\nPaste this into the browser console on the Convoca site:');
  console.log(`  localStorage.setItem('convoca_session_id', '${SESSION_ID}')`);
  console.log('Then refresh the page.\n');
}

run()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
