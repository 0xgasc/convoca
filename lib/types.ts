// lib/types.ts
// Shared types referenced across agents, components, and API routes.

export type CitySlug = 'nyc' | 'guatemala_city';
export type Language = 'en' | 'es' | 'mixed';

// -----------------------------------------------------------------------------
// Causes (controlled vocab — full list in lib/constants.ts)
// -----------------------------------------------------------------------------

export type CauseTag =
  | 'housing' | 'labor' | 'immigration' | 'climate' | 'racial_justice'
  | 'lgbtq_rights' | 'reproductive_rights' | 'food_security' | 'education'
  | 'healthcare' | 'anti_corruption' | 'indigenous_rights' | 'womens_rights'
  | 'police_accountability' | 'mutual_aid' | 'youth' | 'elders'
  | 'disability_justice' | 'anti_war' | 'criminal_justice' | 'voting_rights'
  | 'arts_culture' | 'public_space' | 'transit' | 'anti_displacement'
  | 'language_access';

// -----------------------------------------------------------------------------
// Event types & actions
// -----------------------------------------------------------------------------

export type EventType =
  | 'protest' | 'march' | 'rally' | 'town_hall' | 'public_hearing'
  | 'volunteer_opportunity' | 'mutual_aid_distribution' | 'community_meeting'
  | 'teach_in' | 'vigil' | 'commemoration' | 'skill_share' | 'clinic'
  | 'direct_action' | 'cultural_event' | 'free_public_program'
  | 'community_market' | 'block_party' | 'other';

export type ActionType =
  | 'attend' | 'rsvp' | 'register' | 'bring_supplies' | 'donate' | 'amplify';

export type LocationSpecificity =
  | 'exact_address' | 'landmark' | 'neighborhood' | 'vague' | 'online';

// -----------------------------------------------------------------------------
// Flag types
// -----------------------------------------------------------------------------

export type FlagType =
  | 'ice_presence' | 'police_presence' | 'route_change' | 'counter_protest'
  | 'dispersal_warning' | 'disinfo' | 'medical_aid' | 'safe_space'
  | 'supplies_needed' | 'signup_full' | 'transport_offer' | 'other';

export type FlagSeverity = 'info' | 'caution' | 'urgent';

// -----------------------------------------------------------------------------
// Sources & ingestion
// -----------------------------------------------------------------------------

export type IngestMethod =
  | 'rss' | 'ics' | 'mobilize_api' | 'action_network_rss' | 'telegram_public'
  | 'eventbrite_api' | 'nyc_open_data' | 'legistar_api' | 'website_scrape'
  | 'submission';

export type Borough =
  | 'manhattan' | 'brooklyn' | 'queens' | 'bronx' | 'staten_island'
  | 'citywide';

export interface SourceRow {
  id: string;
  city_slug: CitySlug;
  borough: Borough | null;
  ingest_method: IngestMethod;
  source_url: string | null;
  display_name: string;
  bio: string | null;
  civic_relevance: number | null;
  source_category: string[];
  primary_causes: CauseTag[];
  language: Language;
  monitoring_status: 'active' | 'paused' | 'rejected';
  poll_interval_minutes: number;
  last_polled_at: string | null;
  discovered_via: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Raw posts & extracted events
// -----------------------------------------------------------------------------

export interface RawPost {
  id: string;
  source_id: string;
  external_id: string | null;
  url: string | null;
  posted_at: string | null;
  text_content: string | null;
  image_urls: string[];
  has_event_signal: boolean;
  is_in_scope: boolean | null;
  fetched_at: string;
}

export interface NewRawPost {
  source_id: string;
  external_id?: string;
  url?: string;
  posted_at?: string;
  text_content?: string;
  image_urls?: string[];
}

export interface ExtractedEvent {
  is_event: boolean;
  title: string;
  event_type: EventType;
  action_type: ActionType;
  datetime_iso: string | null;
  datetime_text_raw: string;
  end_datetime_iso: string | null;
  location_text: string;
  location_specificity: LocationSpecificity;
  organizer: string | null;
  cause_tags: CauseTag[];
  language: Language;
  signup_url: string | null;
  capacity: number | null;
  supplies_needed: string[];
  raw_text_extracted: string;
  confidence: number;
  confidence_notes: string;
  // populated after geocoding
  lat?: number;
  lng?: number;
}

export interface CanonicalEvent {
  id: string;
  city_slug: CitySlug;
  title: string;
  event_type: EventType;
  action_type: ActionType;
  datetime_iso: string | null;
  datetime_text_raw: string;
  end_datetime_iso: string | null;
  location_text: string;
  location_specificity: LocationSpecificity;
  lat: number | null;
  lng: number | null;
  organizer: string | null;
  cause_tags: CauseTag[];
  language: Language;
  signup_url: string | null;
  capacity: number | null;
  signup_deadline: string | null;
  status: 'upcoming' | 'live' | 'ended' | 'cancelled';
  extraction_confidence: number | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Intent parse output
// -----------------------------------------------------------------------------

export interface ParsedIntent {
  cause_tags: CauseTag[];
  event_types: EventType[];
  action_prefs: string[];
  date_range_start: string | null;
  date_range_end: string | null;
  neighborhood: string | null;
  search_radius_km: number | null;
  free_text_keywords: string[];
  language_filter: 'en' | 'es' | 'any';
  reasoning: string;
}

// -----------------------------------------------------------------------------
// Recommender output
// -----------------------------------------------------------------------------

export interface RankedEvent {
  event_id: string;
  score: number;
  reasoning: string;
}

// -----------------------------------------------------------------------------
// Safety flag submission + review
// -----------------------------------------------------------------------------

export interface FlagSubmission {
  city_slug: CitySlug;
  event_id: string | null;
  flag_type: FlagType;
  severity: FlagSeverity;
  lat: number;
  lng: number;
  note: string | null;
  reporter_session_id: string;
}

export interface SafetyReviewResult {
  decision: 'approve' | 'block' | 'review';
  reasoning: string;
  redacted_note: string | null;
}

// -----------------------------------------------------------------------------
// User session
// -----------------------------------------------------------------------------

export interface UserSession {
  id: string;
  city_slug: CitySlug;
  cause_prefs: CauseTag[];
  action_prefs: string[];
  language: 'en' | 'es';
  neighborhood: string | null;
  created_at: string;
}
