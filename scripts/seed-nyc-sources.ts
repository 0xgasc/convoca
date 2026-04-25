// scripts/seed-nyc-sources.ts
// Loads the NYC source registry into Supabase. Idempotent — uses upsert on
// (ingest_method, source_url) so re-running is safe.
//
// Run with: npx tsx scripts/seed-nyc-sources.ts

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface SeedSource {
  city_slug: 'nyc' | 'guatemala_city';
  borough?: string;
  ingest_method: string;
  source_url: string | null;
  display_name: string;
  source_category: string[];
  primary_causes: string[];
  language: 'en' | 'es' | 'mixed';
  poll_interval_minutes?: number;
}

const NYC_SOURCES: SeedSource[] = [
  // Citywide civic action
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'website_scrape', source_url: 'https://www.handsoffnyc.com/calendar', display_name: 'Hands Off NYC', source_category: ['protest_org'], primary_causes: ['immigration'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'website_scrape', source_url: 'https://www.riseandresist.org/calendar', display_name: 'Rise and Resist', source_category: ['protest_org'], primary_causes: ['immigration', 'racial_justice'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'website_scrape', source_url: 'https://www.xrebellion.nyc/events', display_name: 'Extinction Rebellion NYC', source_category: ['protest_org'], primary_causes: ['climate'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'rss', source_url: 'https://350nyc.org/feed/', display_name: '350NYC', source_category: ['protest_org'], primary_causes: ['climate'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'mobilize_api', source_url: 'https://www.mobilize.us/citizenactionny/', display_name: 'Citizen Action of NY', source_category: ['protest_org', 'volunteer_coord'], primary_causes: ['housing', 'labor'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'mobilize_api', source_url: 'https://www.mobilize.us/indivisiblebrooklyn/', display_name: 'Indivisible Brooklyn', source_category: ['protest_org'], primary_causes: ['voting_rights'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'mobilize_api', source_url: 'https://www.mobilize.us/indivisiblenationbk/', display_name: 'Indivisible Nation BK', source_category: ['protest_org'], primary_causes: ['immigration'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'rss', source_url: 'https://indypendent.org/feed/', display_name: 'The Indypendent', source_category: ['news_local'], primary_causes: [], language: 'en' },

  // Aggregators (peer projects)
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'website_scrape', source_url: 'https://mutualaid.nyc/mutual-aid-groups/', display_name: 'Mutual Aid NYC directory', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'rss', source_url: 'https://www.theskint.com/feed/', display_name: 'The Skint', source_category: ['arts'], primary_causes: ['arts_culture'], language: 'en' },

  // City government
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'nyc_open_data', source_url: 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json', display_name: 'NYC Permitted Events', source_category: ['government'], primary_causes: [], language: 'en', poll_interval_minutes: 360 },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'legistar_api', source_url: 'https://webapi.legistar.com/v1/nyc', display_name: 'NYC Council Legistar', source_category: ['government'], primary_causes: [], language: 'en', poll_interval_minutes: 360 },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'rss', source_url: 'https://www.nyc.gov/calendar.rss', display_name: 'nyc.gov public events', source_category: ['government'], primary_causes: [], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'website_scrape', source_url: 'https://www.nycgovparks.org/events', display_name: 'NYC Parks events', source_category: ['government'], primary_causes: ['public_space'], language: 'en' },

  // Volunteer hubs
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'rss', source_url: 'https://www.cityharvest.org/feed/', display_name: 'City Harvest', source_category: ['volunteer_coord'], primary_causes: ['food_security'], language: 'en' },
  { city_slug: 'nyc', borough: 'citywide', ingest_method: 'rss', source_url: 'https://www.grownyc.org/feed', display_name: 'GrowNYC', source_category: ['volunteer_coord'], primary_causes: ['food_security', 'climate'], language: 'en' },

  // Manhattan
  { city_slug: 'nyc', borough: 'manhattan', ingest_method: 'rss', source_url: 'https://www.metcouncilonhousing.org/feed', display_name: 'Met Council on Housing', source_category: ['tenant_union'], primary_causes: ['housing'], language: 'en' },
  { city_slug: 'nyc', borough: 'manhattan', ingest_method: 'website_scrape', source_url: 'https://peoplesforum.org/events/', display_name: "The People's Forum", source_category: ['community_org'], primary_causes: ['labor'], language: 'mixed' },
  { city_slug: 'nyc', borough: 'manhattan', ingest_method: 'submission', source_url: null, display_name: "Hell's Kitchen Fridge", source_category: ['mutual_aid'], primary_causes: ['mutual_aid', 'food_security'], language: 'en' },

  // Brooklyn
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'Bushwick Ayuda Mutua', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'es' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'Bed-Stuy Strong', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'Crown Heights Mutual Aid', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'North Brooklyn Mutual Aid', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'Sunset Park Mutual Aid', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'es' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'rss', source_url: 'https://rhicenter.org/feed', display_name: 'Red Hook Initiative', source_category: ['community_org'], primary_causes: ['youth'], language: 'en' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'Equality for Flatbush', source_category: ['tenant_union', 'protest_org'], primary_causes: ['housing', 'racial_justice'], language: 'en' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'submission', source_url: null, display_name: 'Clinton Hill Fort Greene Aid', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'brooklyn', ingest_method: 'rss', source_url: 'https://pioneerworks.org/feed', display_name: 'Pioneer Works', source_category: ['arts'], primary_causes: ['arts_culture'], language: 'en' },

  // Queens
  { city_slug: 'nyc', borough: 'queens', ingest_method: 'submission', source_url: null, display_name: 'Astoria Mutual Aid Network', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'queens', ingest_method: 'rss', source_url: 'https://maketheroadny.org/feed', display_name: 'Make the Road NY', source_category: ['community_org'], primary_causes: ['immigration', 'labor'], language: 'mixed' },
  { city_slug: 'nyc', borough: 'queens', ingest_method: 'rss', source_url: 'https://www.woodsideonthemove.org/feed', display_name: 'Woodside on the Move', source_category: ['community_org'], primary_causes: ['housing'], language: 'mixed' },

  // Bronx
  { city_slug: 'nyc', borough: 'bronx', ingest_method: 'submission', source_url: null, display_name: 'South Bronx Mutual Aid', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'es' },
  { city_slug: 'nyc', borough: 'bronx', ingest_method: 'submission', source_url: null, display_name: 'Casa Bronx', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'es' },
  { city_slug: 'nyc', borough: 'bronx', ingest_method: 'rss', source_url: 'https://www.northwestbronx.org/feed', display_name: 'Northwest Bronx Community & Clergy Coalition', source_category: ['community_org', 'tenant_union'], primary_causes: ['housing'], language: 'mixed' },
  { city_slug: 'nyc', borough: 'bronx', ingest_method: 'submission', source_url: null, display_name: 'The Friendly Fridge BX', source_category: ['mutual_aid'], primary_causes: ['food_security'], language: 'en' },

  // Staten Island
  { city_slug: 'nyc', borough: 'staten_island', ingest_method: 'submission', source_url: null, display_name: 'Staten Island Mutual Aid Network (FAM)', source_category: ['mutual_aid'], primary_causes: ['mutual_aid'], language: 'en' },
  { city_slug: 'nyc', borough: 'staten_island', ingest_method: 'rss', source_url: 'https://projecthospitality.org/feed', display_name: 'Project Hospitality', source_category: ['volunteer_coord'], primary_causes: ['food_security', 'housing'], language: 'en' },
  { city_slug: 'nyc', borough: 'staten_island', ingest_method: 'rss', source_url: 'https://snug-harbor.org/feed', display_name: 'Snug Harbor Cultural Center', source_category: ['arts'], primary_causes: ['arts_culture'], language: 'en' },
];

// Guate seed sources — minimal hand-picked starter set
const GUATE_SOURCES: SeedSource[] = [
  { city_slug: 'guatemala_city', ingest_method: 'submission', source_url: null, display_name: 'Codeca', source_category: ['protest_org'], primary_causes: ['indigenous_rights', 'labor'], language: 'es' },
  { city_slug: 'guatemala_city', ingest_method: 'submission', source_url: null, display_name: 'Movimiento Semilla aligned orgs', source_category: ['protest_org'], primary_causes: ['anti_corruption'], language: 'es' },
];

async function seed() {
  const all = [...NYC_SOURCES, ...GUATE_SOURCES];
  console.log(`Seeding ${all.length} sources...`);

  // Upsert by (ingest_method, source_url) — null source_urls are inserted only if not already present by display_name
  for (const src of all) {
    if (src.source_url) {
      const { error } = await supabase
        .from('sources')
        .upsert(src, { onConflict: 'ingest_method,source_url' });
      if (error) console.error(`Failed to seed ${src.display_name}:`, error.message);
    } else {
      // submission-only sources: check by display_name first to avoid dupes
      const { data: existing } = await supabase
        .from('sources')
        .select('id')
        .eq('display_name', src.display_name)
        .eq('city_slug', src.city_slug)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase.from('sources').insert(src);
        if (error) console.error(`Failed to seed ${src.display_name}:`, error.message);
      }
    }
  }

  console.log('Seed complete.');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
