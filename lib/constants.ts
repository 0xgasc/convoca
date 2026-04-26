// lib/constants.ts
// Single source of truth for all controlled vocabularies.
// Imported by both agent prompts and UI components.

export const CAUSE_VOCABULARY = [
  'housing', 'labor', 'immigration', 'climate', 'racial_justice',
  'lgbtq_rights', 'reproductive_rights', 'food_security', 'education',
  'healthcare', 'anti_corruption', 'indigenous_rights', 'womens_rights',
  'police_accountability', 'mutual_aid', 'youth', 'elders',
  'disability_justice', 'anti_war', 'criminal_justice', 'voting_rights',
  'arts_culture', 'public_space', 'transit', 'anti_displacement',
  'language_access',
] as const;

export const EVENT_TYPES = [
  'protest', 'march', 'rally', 'town_hall', 'public_hearing',
  'volunteer_opportunity', 'mutual_aid_distribution', 'community_meeting',
  'teach_in', 'vigil', 'commemoration', 'skill_share', 'clinic',
  'direct_action', 'cultural_event', 'free_public_program',
  'community_market', 'block_party', 'other',
] as const;

export const ACTION_TYPES = [
  'attend', 'rsvp', 'register', 'bring_supplies', 'donate', 'amplify',
] as const;

export const FLAG_TYPES = [
  'ice_presence', 'police_presence', 'route_change', 'counter_protest',
  'dispersal_warning', 'disinfo', 'medical_aid', 'safe_space',
  'supplies_needed', 'signup_full', 'transport_offer', 'other',
] as const;

// Display metadata for UI
export const EVENT_TYPE_DISPLAY: Record<string, { icon: string; color: string; label_en: string; label_es: string }> = {
  protest:               { icon: 'PRO', color: '#dc2626', label_en: 'Protest',          label_es: 'Protesta' },
  march:                 { icon: 'MCH', color: '#dc2626', label_en: 'March',             label_es: 'Marcha' },
  rally:                 { icon: 'RLY', color: '#ea580c', label_en: 'Rally',             label_es: 'Mitin' },
  town_hall:             { icon: 'TH',  color: '#2563eb', label_en: 'Town hall',         label_es: 'Cabildo' },
  public_hearing:        { icon: 'PH',  color: '#2563eb', label_en: 'Public hearing',    label_es: 'Audiencia pública' },
  volunteer_opportunity: { icon: 'VOL', color: '#16a34a', label_en: 'Volunteer',         label_es: 'Voluntariado' },
  mutual_aid_distribution: { icon: 'AID', color: '#16a34a', label_en: 'Mutual aid',     label_es: 'Ayuda mutua' },
  community_meeting:     { icon: 'MTG', color: '#0891b2', label_en: 'Community meeting', label_es: 'Reunión comunitaria' },
  teach_in:              { icon: 'EDU', color: '#7c3aed', label_en: 'Teach-in',          label_es: 'Charla educativa' },
  vigil:                 { icon: 'VIG', color: '#475569', label_en: 'Vigil',             label_es: 'Vigilia' },
  commemoration:         { icon: 'COM', color: '#475569', label_en: 'Commemoration',     label_es: 'Conmemoración' },
  skill_share:           { icon: 'SKL', color: '#7c3aed', label_en: 'Skill share',       label_es: 'Taller' },
  clinic:                { icon: 'CLI', color: '#16a34a', label_en: 'Clinic',            label_es: 'Clínica' },
  direct_action:         { icon: 'ACT', color: '#dc2626', label_en: 'Direct action',     label_es: 'Acción directa' },
  cultural_event:        { icon: 'CUL', color: '#d97706', label_en: 'Cultural event',    label_es: 'Evento cultural' },
  free_public_program:   { icon: 'FRE', color: '#d97706', label_en: 'Free program',      label_es: 'Programa gratuito' },
  community_market:      { icon: 'MKT', color: '#d97706', label_en: 'Community market',  label_es: 'Mercado' },
  block_party:           { icon: 'BLK', color: '#d97706', label_en: 'Block party',       label_es: 'Fiesta de barrio' },
  other:                 { icon: '·',   color: '#6b7280', label_en: 'Other',             label_es: 'Otro' },
};

export const CAUSE_DISPLAY: Record<string, { label_en: string; label_es: string }> = {
  housing: { label_en: 'Housing', label_es: 'Vivienda' },
  labor: { label_en: 'Labor', label_es: 'Trabajo' },
  immigration: { label_en: 'Immigration', label_es: 'Migración' },
  climate: { label_en: 'Climate', label_es: 'Clima' },
  racial_justice: { label_en: 'Racial justice', label_es: 'Justicia racial' },
  lgbtq_rights: { label_en: 'LGBTQ+ rights', label_es: 'Derechos LGBTQ+' },
  reproductive_rights: { label_en: 'Reproductive rights', label_es: 'Derechos reproductivos' },
  food_security: { label_en: 'Food security', label_es: 'Seguridad alimentaria' },
  education: { label_en: 'Education', label_es: 'Educación' },
  healthcare: { label_en: 'Healthcare', label_es: 'Salud' },
  anti_corruption: { label_en: 'Anti-corruption', label_es: 'Anti-corrupción' },
  indigenous_rights: { label_en: 'Indigenous rights', label_es: 'Derechos indígenas' },
  womens_rights: { label_en: "Women's rights", label_es: 'Derechos de las mujeres' },
  police_accountability: { label_en: 'Police accountability', label_es: 'Rendición de cuentas policial' },
  mutual_aid: { label_en: 'Mutual aid', label_es: 'Ayuda mutua' },
  youth: { label_en: 'Youth', label_es: 'Juventud' },
  elders: { label_en: 'Elders', label_es: 'Adultos mayores' },
  disability_justice: { label_en: 'Disability justice', label_es: 'Justicia para personas con discapacidad' },
  anti_war: { label_en: 'Anti-war', label_es: 'Anti-guerra' },
  criminal_justice: { label_en: 'Criminal justice', label_es: 'Justicia penal' },
  voting_rights: { label_en: 'Voting rights', label_es: 'Derecho al voto' },
  arts_culture: { label_en: 'Arts & culture', label_es: 'Arte y cultura' },
  public_space: { label_en: 'Public space', label_es: 'Espacio público' },
  transit: { label_en: 'Transit', label_es: 'Transporte' },
  anti_displacement: { label_en: 'Anti-displacement', label_es: 'Anti-desplazamiento' },
  language_access: { label_en: 'Language access', label_es: 'Acceso lingüístico' },
};

export const FLAG_TYPE_DISPLAY: Record<string, {
  icon: string;
  abbr: string;
  color: string;
  label_en: string;
  label_es: string;
  default_ttl_minutes: number;
  applicable_cities: string[];
}> = {
  ice_presence:      { icon: 'ICE', abbr: 'ICE', color: '#dc2626', label_en: 'ICE presence',      label_es: 'Presencia de ICE',          default_ttl_minutes: 240,  applicable_cities: ['nyc'] },
  police_presence:   { icon: 'PD',  abbr: 'PD',  color: '#ea580c', label_en: 'Police presence',   label_es: 'Presencia policial',         default_ttl_minutes: 120,  applicable_cities: ['nyc', 'guatemala_city'] },
  route_change:      { icon: 'RTE', abbr: 'RTE', color: '#ca8a04', label_en: 'Route change',       label_es: 'Cambio de ruta',             default_ttl_minutes: 180,  applicable_cities: ['nyc', 'guatemala_city'] },
  counter_protest:   { icon: 'CP',  abbr: 'CP',  color: '#b91c1c', label_en: 'Counter-protest',    label_es: 'Contra-manifestación',       default_ttl_minutes: 120,  applicable_cities: ['nyc', 'guatemala_city'] },
  dispersal_warning: { icon: 'DSP', abbr: 'DSP', color: '#991b1b', label_en: 'Dispersal warning',  label_es: 'Aviso de dispersión',        default_ttl_minutes: 60,   applicable_cities: ['nyc', 'guatemala_city'] },
  disinfo:           { icon: '?',   abbr: '?',   color: '#7c3aed', label_en: 'Possible disinfo',   label_es: 'Posible desinformación',     default_ttl_minutes: 1440, applicable_cities: ['nyc', 'guatemala_city'] },
  medical_aid:       { icon: '+',   abbr: '+',   color: '#16a34a', label_en: 'Medical aid',         label_es: 'Punto de auxilio',           default_ttl_minutes: 360,  applicable_cities: ['nyc', 'guatemala_city'] },
  safe_space:        { icon: 'SS',  abbr: 'SS',  color: '#0891b2', label_en: 'Safe space',          label_es: 'Espacio seguro',             default_ttl_minutes: 480,  applicable_cities: ['nyc', 'guatemala_city'] },
  supplies_needed:   { icon: 'SUP', abbr: 'SUP', color: '#2563eb', label_en: 'Supplies needed',     label_es: 'Se necesitan suministros',   default_ttl_minutes: 360,  applicable_cities: ['nyc', 'guatemala_city'] },
  signup_full:       { icon: 'FUL', abbr: 'FUL', color: '#6b7280', label_en: 'Signup full',         label_es: 'Cupo lleno',                 default_ttl_minutes: 1440, applicable_cities: ['nyc', 'guatemala_city'] },
  transport_offer:   { icon: 'TRP', abbr: 'TRP', color: '#0d9488', label_en: 'Transport offered',   label_es: 'Transporte disponible',      default_ttl_minutes: 240,  applicable_cities: ['nyc', 'guatemala_city'] },
  other:             { icon: '·',   abbr: '·',   color: '#6b7280', label_en: 'Other',               label_es: 'Otro',                       default_ttl_minutes: 120,  applicable_cities: ['nyc', 'guatemala_city'] },
};

export const CITIES = {
  nyc:              { display_name: 'New York City',       country: 'US', default_language: 'en' as const, center: { lat: 40.7128, lng: -74.0060 }, timezone: 'America/New_York',     status: 'live'   as const },
  guatemala_city:   { display_name: 'Ciudad de Guatemala', country: 'GT', default_language: 'es' as const, center: { lat: 14.6349, lng: -90.5069 }, timezone: 'America/Guatemala',    status: 'live'   as const },
  los_angeles:      { display_name: 'Los Angeles',         country: 'US', default_language: 'en' as const, center: { lat: 34.0522, lng: -118.2437 }, timezone: 'America/Los_Angeles', status: 'soon'   as const },
  san_francisco:    { display_name: 'San Francisco',       country: 'US', default_language: 'en' as const, center: { lat: 37.7749, lng: -122.4194 }, timezone: 'America/Los_Angeles', status: 'soon'   as const },
  chicago:          { display_name: 'Chicago',             country: 'US', default_language: 'en' as const, center: { lat: 41.8781, lng:  -87.6298 }, timezone: 'America/Chicago',     status: 'soon'   as const },
  washington_dc:    { display_name: 'Washington DC',       country: 'US', default_language: 'en' as const, center: { lat: 38.9072, lng:  -77.0369 }, timezone: 'America/New_York',    status: 'soon'   as const },
  boston:           { display_name: 'Boston',              country: 'US', default_language: 'en' as const, center: { lat: 42.3601, lng:  -71.0589 }, timezone: 'America/New_York',    status: 'soon'   as const },
  seattle:          { display_name: 'Seattle',             country: 'US', default_language: 'en' as const, center: { lat: 47.6062, lng: -122.3321 }, timezone: 'America/Los_Angeles', status: 'soon'   as const },
  philadelphia:     { display_name: 'Philadelphia',        country: 'US', default_language: 'en' as const, center: { lat: 39.9526, lng:  -75.1652 }, timezone: 'America/New_York',    status: 'soon'   as const },
  miami:            { display_name: 'Miami',               country: 'US', default_language: 'en' as const, center: { lat: 25.7617, lng:  -80.1918 }, timezone: 'America/New_York',    status: 'soon'   as const },
};

export const NYC_BOROUGHS = [
  { slug: 'manhattan',     name: 'Manhattan',     center: { lat: 40.7831, lng: -73.9712 } },
  { slug: 'brooklyn',      name: 'Brooklyn',      center: { lat: 40.6782, lng: -73.9442 } },
  { slug: 'queens',        name: 'Queens',        center: { lat: 40.7282, lng: -73.7949 } },
  { slug: 'bronx',         name: 'Bronx',         center: { lat: 40.8448, lng: -73.8648 } },
  { slug: 'staten_island', name: 'Staten Island', center: { lat: 40.5795, lng: -74.1502 } },
] as const;

export type NycBoroughSlug = typeof NYC_BOROUGHS[number]['slug'];

// Approximate bounding boxes for geographic filtering (flags, lat/lng-based events)
export const BOROUGH_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  manhattan:     { minLat: 40.700, maxLat: 40.880, minLng: -74.020, maxLng: -73.910 },
  brooklyn:      { minLat: 40.570, maxLat: 40.740, minLng: -74.045, maxLng: -73.833 },
  queens:        { minLat: 40.540, maxLat: 40.820, minLng: -73.962, maxLng: -73.700 },
  bronx:         { minLat: 40.785, maxLat: 40.916, minLng: -73.933, maxLng: -73.750 },
  staten_island: { minLat: 40.477, maxLat: 40.651, minLng: -74.260, maxLng: -74.052 },
};

// Keywords used for client-side borough matching against location_text
export const BOROUGH_KEYWORDS: Record<string, string[]> = {
  manhattan: [
    'manhattan', 'midtown', 'lower east side', 'upper east side',
    'upper west side', 'harlem', 'east harlem', 'washington heights', 'inwood',
    'chelsea', "hell's kitchen", 'soho', 'tribeca', 'noho',
    'nolita', 'greenwich village', 'west village', 'east village', 'flatiron',
    'gramercy', 'kips bay', 'murray hill', 'battery park city', 'financial district',
    'foley square', 'city hall park', 'civic center', 'little italy',
    'two bridges', 'morningside heights', 'hamilton heights', 'sugar hill',
    'lenox hill', 'yorkville', 'carnegie hill', 'washington square',
    'times square', 'union square', 'central park', 'hudson yards',
  ],
  brooklyn: [
    'brooklyn', 'bushwick', 'bed-stuy', 'bedford-stuyvesant', 'crown heights',
    'park slope', 'williamsburg', 'sunset park', 'flatbush', 'east flatbush',
    'canarsie', 'east new york', 'greenpoint', 'red hook', 'dumbo', 'cobble hill',
    'carroll gardens', 'gowanus', 'prospect heights', 'fort greene', 'clinton hill',
    'bay ridge', 'bensonhurst', 'borough park', 'marine park', 'sheepshead bay',
    'brighton beach', 'coney island', 'brownsville', 'ocean hill', 'flatlands',
    'ditmas park', 'kensington', 'windsor terrace', 'boerum hill',
    'prospect park', 'downtown brooklyn', 'brooklyn heights', 'fulton mall',
  ],
  queens: [
    'queens', 'astoria', 'jackson heights', 'flushing', 'jamaica', 'forest hills',
    'corona', 'rego park', 'long island city', 'sunnyside', 'woodside', 'elmhurst',
    'ridgewood', 'maspeth', 'glendale', 'richmond hill', 'south ozone park',
    'howard beach', 'rockaway', 'far rockaway', 'college point', 'whitestone',
    'bayside', 'fresh meadows', 'hollis', 'springfield gardens', 'laurelton',
  ],
  bronx: [
    'bronx', 'south bronx', 'mott haven', 'hunts point', 'fordham', 'riverdale',
    'university heights', 'tremont', 'morrisania', 'concourse', 'highbridge',
    'claremont', 'belmont', 'morris heights', 'pelham bay', 'co-op city',
    'norwood', 'wakefield', 'williamsbridge', 'eastchester', 'soundview',
  ],
  staten_island: [
    'staten island', 'st. george', 'st george', 'stapleton', 'port richmond',
    'new brighton', 'tompkinsville', 'clifton', 'rosebank',
  ],
};

// Neighborhoods grouped by borough, for nested filter UI
export const NYC_NEIGHBORHOODS: Record<string, Array<{ slug: string; name: string }>> = {
  manhattan: [
    { slug: 'harlem', name: 'Harlem' },
    { slug: 'washington_heights', name: 'Washington Heights' },
    { slug: 'upper_west_side', name: 'Upper West Side' },
    { slug: 'upper_east_side', name: 'Upper East Side' },
    { slug: 'midtown', name: 'Midtown' },
    { slug: 'chelsea', name: 'Chelsea' },
    { slug: 'east_village', name: 'East Village' },
    { slug: 'lower_east_side', name: 'Lower East Side' },
    { slug: 'downtown', name: 'Downtown / FiDi' },
    { slug: 'chinatown', name: 'Chinatown' },
  ],
  brooklyn: [
    { slug: 'bushwick', name: 'Bushwick' },
    { slug: 'bed_stuy', name: 'Bed-Stuy' },
    { slug: 'crown_heights', name: 'Crown Heights' },
    { slug: 'sunset_park', name: 'Sunset Park' },
    { slug: 'williamsburg', name: 'Williamsburg' },
    { slug: 'park_slope', name: 'Park Slope' },
    { slug: 'red_hook', name: 'Red Hook' },
    { slug: 'brownsville', name: 'Brownsville' },
    { slug: 'east_new_york', name: 'East New York' },
    { slug: 'flatbush', name: 'Flatbush' },
  ],
  queens: [
    { slug: 'jackson_heights', name: 'Jackson Heights' },
    { slug: 'astoria', name: 'Astoria' },
    { slug: 'corona', name: 'Corona' },
    { slug: 'flushing', name: 'Flushing' },
    { slug: 'jamaica', name: 'Jamaica' },
    { slug: 'long_island_city', name: 'Long Island City' },
    { slug: 'woodside', name: 'Woodside' },
    { slug: 'ridgewood', name: 'Ridgewood' },
  ],
  bronx: [
    { slug: 'south_bronx', name: 'South Bronx' },
    { slug: 'mott_haven', name: 'Mott Haven' },
    { slug: 'hunts_point', name: 'Hunts Point' },
    { slug: 'fordham', name: 'Fordham' },
    { slug: 'highbridge', name: 'Highbridge' },
    { slug: 'riverdale', name: 'Riverdale' },
  ],
  staten_island: [
    { slug: 'st_george', name: 'St. George' },
    { slug: 'stapleton', name: 'Stapleton' },
    { slug: 'port_richmond', name: 'Port Richmond' },
  ],
};
