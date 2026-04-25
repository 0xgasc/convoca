-- schema.sql
-- Run this in the Supabase SQL editor after creating a new project.
-- Idempotent — safe to re-run during development.

create extension if not exists vector;

-- =============================================================================
-- Cities
-- =============================================================================

create table if not exists cities (
  slug text primary key,
  display_name text not null,
  country text not null,
  default_language text not null,
  center_lat numeric(9,6) not null,
  center_lng numeric(9,6) not null,
  timezone text not null
);

insert into cities (slug, display_name, country, default_language, center_lat, center_lng, timezone) values
  ('nyc', 'New York City', 'US', 'en', 40.7128, -74.0060, 'America/New_York'),
  ('guatemala_city', 'Ciudad de Guatemala', 'GT', 'es', 14.6349, -90.5069, 'America/Guatemala')
on conflict (slug) do nothing;

-- =============================================================================
-- Sources
-- =============================================================================

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  city_slug text references cities(slug),
  borough text,
  ingest_method text not null check (ingest_method in (
    'rss','ics','mobilize_api','action_network_rss','telegram_public',
    'eventbrite_api','nyc_open_data','legistar_api','website_scrape',
    'submission'
  )),
  source_url text,
  display_name text not null,
  bio text,
  civic_relevance numeric(3,2),
  source_category text[] default '{}',
  primary_causes text[] default '{}',
  language text default 'en',
  monitoring_status text default 'active' check (monitoring_status in ('active','paused','rejected')),
  poll_interval_minutes int default 60,
  last_polled_at timestamptz,
  discovered_via uuid references sources(id),
  created_at timestamptz default now(),
  unique(ingest_method, source_url)
);

-- =============================================================================
-- Raw posts (pre-extraction)
-- =============================================================================

create table if not exists raw_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  external_id text,
  url text,
  posted_at timestamptz,
  text_content text,
  image_urls text[] default '{}',
  has_event_signal boolean default false,
  is_in_scope boolean,
  fetched_at timestamptz default now()
);

create index if not exists raw_posts_fetched_at_idx on raw_posts (fetched_at desc);

-- =============================================================================
-- Canonical events
-- =============================================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  city_slug text references cities(slug),
  title text not null,
  event_type text not null check (event_type in (
    'protest','march','rally','town_hall','public_hearing',
    'volunteer_opportunity','mutual_aid_distribution','community_meeting',
    'teach_in','vigil','commemoration','skill_share','clinic',
    'direct_action','cultural_event','free_public_program','community_market',
    'block_party','other'
  )),
  action_type text default 'attend' check (action_type in (
    'attend','rsvp','register','bring_supplies','donate','amplify'
  )),
  datetime_iso timestamptz,
  datetime_text_raw text,
  end_datetime_iso timestamptz,
  location_text text,
  location_specificity text check (location_specificity in (
    'exact_address','landmark','neighborhood','vague','online'
  )),
  lat numeric(9,6),
  lng numeric(9,6),
  organizer text,
  cause_tags text[] default '{}',
  language text default 'en',
  signup_url text,
  capacity int,
  signup_deadline timestamptz,
  status text default 'upcoming' check (status in (
    'upcoming','live','ended','cancelled'
  )),
  extraction_confidence numeric(3,2),
  embedding vector(1024),
  created_at timestamptz default now()
);

create index if not exists events_datetime_idx on events (datetime_iso) where status = 'upcoming';
create index if not exists events_embedding_idx on events using ivfflat (embedding vector_cosine_ops);

-- =============================================================================
-- Event sources (M2M between canonical events and raw posts)
-- =============================================================================

create table if not exists event_sources (
  event_id uuid references events(id) on delete cascade,
  raw_post_id uuid references raw_posts(id) on delete cascade,
  primary key (event_id, raw_post_id)
);

-- =============================================================================
-- Hyperlocal community safety / supply flags
-- =============================================================================

create table if not exists event_flags (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  city_slug text references cities(slug),
  flag_type text not null check (flag_type in (
    'ice_presence','police_presence','route_change','counter_protest',
    'dispersal_warning','disinfo','medical_aid','safe_space',
    'supplies_needed','signup_full','transport_offer','other'
  )),
  severity text default 'caution' check (severity in ('info','caution','urgent')),
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  note text,
  reporter_session_id text not null,
  confirmation_count int default 1,
  status text default 'pending' check (status in ('pending','approved','blocked','review')),
  safety_review_reasoning text,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create index if not exists event_flags_recent_idx on event_flags (created_at desc) where status = 'approved';

-- =============================================================================
-- Flag type config
-- =============================================================================

create table if not exists flag_type_config (
  flag_type text primary key,
  default_ttl_minutes int not null,
  icon text,
  color text,
  display_label_es text,
  display_label_en text,
  applicable_cities text[] default '{nyc,guatemala_city}'
);

insert into flag_type_config values
  ('ice_presence',      240, '🛑', '#dc2626', 'Presencia de ICE',          'ICE presence',         '{nyc}'),
  ('police_presence',   120, '👮', '#ea580c', 'Presencia policial',        'Police presence',      '{nyc,guatemala_city}'),
  ('route_change',      180, '↪️', '#ca8a04', 'Cambio de ruta',            'Route change',         '{nyc,guatemala_city}'),
  ('counter_protest',   120, '⚠️', '#b91c1c', 'Contra-manifestación',      'Counter-protest',      '{nyc,guatemala_city}'),
  ('dispersal_warning',  60, '🚨', '#991b1b', 'Aviso de dispersión',       'Dispersal warning',    '{nyc,guatemala_city}'),
  ('disinfo',          1440, '❓', '#7c3aed', 'Posible desinformación',    'Possible disinfo',     '{nyc,guatemala_city}'),
  ('medical_aid',       360, '➕', '#16a34a', 'Punto de auxilio',          'Medical aid',          '{nyc,guatemala_city}'),
  ('safe_space',        480, '🏠', '#0891b2', 'Espacio seguro',            'Safe space',           '{nyc,guatemala_city}'),
  ('supplies_needed',   360, '📦', '#2563eb', 'Se necesitan suministros',  'Supplies needed',      '{nyc,guatemala_city}'),
  ('signup_full',      1440, '🚫', '#6b7280', 'Cupo lleno',                'Signup full',          '{nyc,guatemala_city}'),
  ('transport_offer',   240, '🚗', '#0d9488', 'Transporte disponible',     'Transport offered',    '{nyc,guatemala_city}'),
  ('other',             120, '📍', '#6b7280', 'Otro',                      'Other',                '{nyc,guatemala_city}')
on conflict (flag_type) do nothing;

-- =============================================================================
-- Submissions (community-contributed flyers/URLs)
-- =============================================================================

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  city_slug text references cities(slug),
  submitted_by_session text,
  submission_type text not null check (submission_type in ('image_upload','url','text')),
  payload text not null,
  status text default 'pending' check (status in ('pending','processing','approved','rejected','duplicate')),
  result_event_id uuid references events(id),
  rejection_reason text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists submissions_status_idx on submissions (status, created_at desc);

-- =============================================================================
-- User sessions (no auth; session-based prefs only)
-- =============================================================================

create table if not exists user_sessions (
  id text primary key,
  city_slug text references cities(slug),
  cause_prefs text[] default '{}',
  action_prefs text[] default '{attend}',
  language text default 'en',
  neighborhood text,
  created_at timestamptz default now()
);

-- =============================================================================
-- Agent run traces (for live demo trace panel + observability)
-- =============================================================================

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  agent_name text not null,
  input_summary text,
  output_summary text,
  reasoning_trace jsonb,
  duration_ms int,
  model text,
  created_at timestamptz default now()
);

create index if not exists agent_runs_session_idx on agent_runs (session_id, created_at desc);
