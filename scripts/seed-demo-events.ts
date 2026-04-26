// scripts/seed-demo-events.ts
// Hand-crafted realistic events + a dedup demo trio (same event from 3 sources)
// + example flags. Idempotent — wipes prior demo rows by title prefix.
//
// Run with: npm run seed:demo

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PREFIX = '[DEMO] ';

interface DemoEvent {
  title: string;
  event_type: string;
  action_type?: string;
  datetime: Date;
  end_datetime?: Date;
  location_text: string;
  location_specificity: string;
  lat: number;
  lng: number;
  organizer: string;
  cause_tags: string[];
  language?: 'en' | 'es' | 'mixed';
  signup_url?: string;
  city: 'nyc' | 'guatemala_city';
  borough?: string;
}

const day = (offset: number, hour = 12, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, min, 0, 0);
  return d;
};

const NYC_DEMO: DemoEvent[] = [
  {
    title: 'Saturday Food Distribution — Bushwick',
    event_type: 'mutual_aid_distribution',
    datetime: day(2, 10),
    location_text: 'Maria Hernandez Park, Bushwick',
    location_specificity: 'landmark',
    lat: 40.6982, lng: -73.9234,
    organizer: 'Bushwick Ayuda Mutua',
    cause_tags: ['mutual_aid', 'food_security'],
    language: 'mixed',
    city: 'nyc', borough: 'brooklyn',
  },
  {
    title: 'Housing Justice Rally at City Hall',
    event_type: 'rally',
    datetime: day(3, 17),
    location_text: 'City Hall Park, Manhattan',
    location_specificity: 'exact_address',
    lat: 40.7127, lng: -74.0059,
    organizer: 'Met Council on Housing',
    cause_tags: ['housing', 'anti_displacement'],
    signup_url: 'https://www.metcouncilonhousing.org/',
    city: 'nyc', borough: 'manhattan',
  },
  {
    title: 'Climate March: Stop the Pipeline',
    event_type: 'march',
    datetime: day(5, 11),
    location_text: 'Foley Square → Battery Park',
    location_specificity: 'landmark',
    lat: 40.7142, lng: -74.0028,
    organizer: '350NYC',
    cause_tags: ['climate'],
    signup_url: 'https://350nyc.org/',
    city: 'nyc', borough: 'manhattan',
  },
  {
    title: 'Free Legal Clinic — Know Your Rights',
    event_type: 'clinic',
    action_type: 'register',
    datetime: day(1, 18),
    location_text: 'Make the Road NY, Bushwick office',
    location_specificity: 'exact_address',
    lat: 40.7041, lng: -73.9234,
    organizer: 'Make the Road NY',
    cause_tags: ['immigration', 'language_access'],
    language: 'mixed',
    signup_url: 'https://maketheroadny.org/',
    city: 'nyc', borough: 'brooklyn',
  },
  {
    title: 'Volunteer: Park Cleanup Day',
    event_type: 'volunteer_opportunity',
    action_type: 'rsvp',
    datetime: day(6, 9),
    location_text: 'Prospect Park, Brooklyn',
    location_specificity: 'landmark',
    lat: 40.6602, lng: -73.9690,
    organizer: 'GrowNYC',
    cause_tags: ['climate', 'public_space'],
    signup_url: 'https://www.grownyc.org/volunteer',
    city: 'nyc', borough: 'brooklyn',
  },
  {
    title: 'NYC Council Public Hearing: Tenant Protections',
    event_type: 'public_hearing',
    datetime: day(4, 14),
    location_text: '250 Broadway, 16th Floor Hearing Room',
    location_specificity: 'exact_address',
    lat: 40.7128, lng: -74.0064,
    organizer: 'NYC Council',
    cause_tags: ['housing', 'voting_rights'],
    city: 'nyc', borough: 'manhattan',
  },
  {
    title: 'Free Library Reading: Voices of Diaspora',
    event_type: 'free_public_program',
    datetime: day(2, 19),
    location_text: 'Brooklyn Public Library — Central Branch',
    location_specificity: 'exact_address',
    lat: 40.6726, lng: -73.9683,
    organizer: 'Brooklyn Public Library',
    cause_tags: ['arts_culture', 'language_access'],
    city: 'nyc', borough: 'brooklyn',
  },
  {
    title: 'Vigil for Migrant Workers',
    event_type: 'vigil',
    datetime: day(1, 19, 30),
    location_text: 'Washington Square Park',
    location_specificity: 'landmark',
    lat: 40.7308, lng: -73.9974,
    organizer: 'Rise and Resist',
    cause_tags: ['immigration', 'labor'],
    city: 'nyc', borough: 'manhattan',
  },
  {
    title: 'Repair Café — Bring broken stuff',
    event_type: 'community_market',
    datetime: day(7, 12),
    location_text: 'The People\'s Forum',
    location_specificity: 'exact_address',
    lat: 40.7574, lng: -73.9907,
    organizer: 'The People\'s Forum',
    cause_tags: ['mutual_aid', 'climate'],
    city: 'nyc', borough: 'manhattan',
  },
  {
    title: 'South Bronx Skill Share: Bike Repair',
    event_type: 'skill_share',
    datetime: day(3, 14),
    location_text: 'Brook Park, Bronx',
    location_specificity: 'landmark',
    lat: 40.8147, lng: -73.9134,
    organizer: 'South Bronx Mutual Aid',
    cause_tags: ['mutual_aid', 'youth'],
    language: 'es',
    city: 'nyc', borough: 'bronx',
  },
  {
    title: 'Town Hall: Affordable Housing in Astoria',
    event_type: 'town_hall',
    datetime: day(5, 19),
    location_text: 'Astoria Library Community Room',
    location_specificity: 'exact_address',
    lat: 40.7720, lng: -73.9159,
    organizer: 'Astoria Mutual Aid Network',
    cause_tags: ['housing'],
    city: 'nyc', borough: 'queens',
  },
  {
    title: 'Block Party: Crown Heights',
    event_type: 'block_party',
    datetime: day(8, 14),
    end_datetime: day(8, 21),
    location_text: 'Eastern Parkway, Crown Heights',
    location_specificity: 'landmark',
    lat: 40.6710, lng: -73.9531,
    organizer: 'Crown Heights Mutual Aid',
    cause_tags: ['mutual_aid', 'arts_culture'],
    city: 'nyc', borough: 'brooklyn',
  },
];

// Dedup demo trio — same event from three orgs, slightly different wording
const DEDUP_TRIO: DemoEvent[] = [
  {
    title: 'Sunday Food Distribution — Sunset Park',
    event_type: 'mutual_aid_distribution',
    datetime: day(3, 11),
    location_text: 'Sunset Park, 5th Ave & 44th St',
    location_specificity: 'landmark',
    lat: 40.6453, lng: -74.0095,
    organizer: 'Sunset Park Mutual Aid',
    cause_tags: ['mutual_aid', 'food_security'],
    language: 'es',
    city: 'nyc', borough: 'brooklyn',
  },
  {
    title: 'Distribución de comida — Sunset Park',
    event_type: 'mutual_aid_distribution',
    datetime: day(3, 11, 15),
    location_text: 'Sunset Park (44th St entrance)',
    location_specificity: 'landmark',
    lat: 40.6450, lng: -74.0090,
    organizer: 'Hispanic Federation NYC',
    cause_tags: ['mutual_aid', 'food_security'],
    language: 'es',
    city: 'nyc', borough: 'brooklyn',
  },
  {
    title: 'Free groceries this Sunday in Sunset Park',
    event_type: 'mutual_aid_distribution',
    datetime: day(3, 11, 30),
    location_text: '5th Avenue at 44th, Brooklyn',
    location_specificity: 'landmark',
    lat: 40.6451, lng: -74.0088,
    organizer: "Bay Ridge Bushwick Coalition",
    cause_tags: ['mutual_aid', 'food_security'],
    city: 'nyc', borough: 'brooklyn',
  },
];

const GUATE_DEMO: DemoEvent[] = [
  {
    title: 'Manifestación contra la corrupción — Plaza de la Constitución',
    event_type: 'protest',
    datetime: day(2, 16),
    location_text: 'Plaza de la Constitución, Zona 1',
    location_specificity: 'landmark',
    lat: 14.6418, lng: -90.5133,
    organizer: 'Movimiento Semilla aligned orgs',
    cause_tags: ['anti_corruption'],
    language: 'es',
    city: 'guatemala_city',
  },
  {
    title: 'Asamblea Comunitaria — Zona 10',
    event_type: 'community_meeting',
    datetime: day(4, 18),
    location_text: 'Parque La Reforma, Zona 10',
    location_specificity: 'landmark',
    lat: 14.5998, lng: -90.5114,
    organizer: 'Codeca',
    cause_tags: ['indigenous_rights', 'labor'],
    language: 'es',
    city: 'guatemala_city',
  },
];

interface DemoFlag {
  city: 'nyc' | 'guatemala_city';
  flag_type: string;
  severity: 'info' | 'caution' | 'urgent';
  lat: number; lng: number;
  note: string;
}

const NYC_DEMO_FLAGS: DemoFlag[] = [
  { city: 'nyc', flag_type: 'medical_aid',     severity: 'info',    lat: 40.7142, lng: -74.0028, note: 'Medic team set up at Foley Square south end' },
  { city: 'nyc', flag_type: 'police_presence', severity: 'caution', lat: 40.7127, lng: -74.0072, note: 'Heavy NYPD presence around City Hall west side' },
  { city: 'nyc', flag_type: 'route_change',    severity: 'caution', lat: 40.7150, lng: -74.0010, note: 'March now exiting via Centre St, not Broadway' },
  { city: 'nyc', flag_type: 'supplies_needed', severity: 'info',    lat: 40.6982, lng: -73.9234, note: 'Bring water + diapers if you can — running low' },
  { city: 'nyc', flag_type: 'safe_space',      severity: 'info',    lat: 40.7308, lng: -73.9974, note: 'Open-door coffee shop on east side of WSP' },
  { city: 'nyc', flag_type: 'transport_offer', severity: 'info',    lat: 40.6453, lng: -74.0095, note: 'Carpool from Sunset Park to housing rally — DM @sunsetayuda' },
  { city: 'nyc', flag_type: 'ice_presence',    severity: 'urgent',  lat: 40.7041, lng: -73.9234, note: 'ICE vehicles spotted on Knickerbocker near the clinic. Avoid.' },
  { city: 'nyc', flag_type: 'signup_full',     severity: 'info',    lat: 40.6602, lng: -73.9690, note: 'Park cleanup at capacity — try next weekend' },
];

const GUATE_DEMO_FLAGS: DemoFlag[] = [
  { city: 'guatemala_city', flag_type: 'police_presence', severity: 'caution', lat: 14.6418, lng: -90.5133, note: 'PNC en perímetro de la plaza' },
  { city: 'guatemala_city', flag_type: 'medical_aid',     severity: 'info',    lat: 14.6420, lng: -90.5128, note: 'Brigada médica en esquina norte' },
];

async function clearPrior() {
  const events = await prisma.event.findMany({
    where: { title: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  if (events.length > 0) {
    const ids = events.map(e => e.id);
    await prisma.eventSource.deleteMany({ where: { event_id: { in: ids } } });
    await prisma.eventFlag.deleteMany({ where: { event_id: { in: ids } } });
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.eventFlag.deleteMany({
    where: { reporter_session_id: 'demo-seed' },
  });
}

async function insertEvent(e: DemoEvent) {
  return prisma.event.create({
    data: {
      city_slug: e.city,
      title: DEMO_PREFIX + e.title,
      event_type: e.event_type,
      action_type: e.action_type ?? 'attend',
      datetime_iso: e.datetime,
      datetime_text_raw: humanDate(e.datetime),
      end_datetime_iso: e.end_datetime ?? null,
      location_text: e.location_text,
      location_specificity: e.location_specificity,
      lat: e.lat,
      lng: e.lng,
      organizer: e.organizer,
      cause_tags: e.cause_tags,
      language: e.language ?? 'en',
      signup_url: e.signup_url ?? null,
      extraction_confidence: 0.9,
      status: 'upcoming',
    },
    select: { id: true },
  });
}

function humanDate(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

async function main() {
  console.log('Clearing prior demo data...');
  await clearPrior();

  const allEvents = [...NYC_DEMO, ...DEDUP_TRIO, ...GUATE_DEMO];
  console.log(`Seeding ${allEvents.length} events...`);
  for (const e of allEvents) {
    await insertEvent(e);
  }

  const allFlags = [...NYC_DEMO_FLAGS, ...GUATE_DEMO_FLAGS];
  console.log(`Seeding ${allFlags.length} flags...`);
  for (const f of allFlags) {
    const ttlMin = 60 * 24 * 30; // 30 days — demo flags don't expire mid-demo
    await prisma.eventFlag.create({
      data: {
        city_slug: f.city,
        flag_type: f.flag_type,
        severity: f.severity,
        lat: f.lat,
        lng: f.lng,
        note: f.note,
        reporter_session_id: 'demo-seed',
        status: 'approved',
        safety_review_reasoning: 'demo seed — auto-approved',
        expires_at: new Date(Date.now() + ttlMin * 60_000),
      },
    });
  }

  console.log('Done. NYC events: ' + NYC_DEMO.length + ', dedup trio: ' + DEDUP_TRIO.length + ', Guate events: ' + GUATE_DEMO.length + ', flags: ' + allFlags.length);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
