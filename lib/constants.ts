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
export const EVENT_TYPE_DISPLAY: Record<string, { icon: string; label_en: string; label_es: string }> = {
  protest: { icon: '✊', label_en: 'Protest', label_es: 'Protesta' },
  march: { icon: '🚶', label_en: 'March', label_es: 'Marcha' },
  rally: { icon: '📣', label_en: 'Rally', label_es: 'Mitin' },
  town_hall: { icon: '🏛️', label_en: 'Town hall', label_es: 'Cabildo' },
  public_hearing: { icon: '⚖️', label_en: 'Public hearing', label_es: 'Audiencia pública' },
  volunteer_opportunity: { icon: '🙋', label_en: 'Volunteer', label_es: 'Voluntariado' },
  mutual_aid_distribution: { icon: '🤝', label_en: 'Mutual aid', label_es: 'Ayuda mutua' },
  community_meeting: { icon: '👥', label_en: 'Community meeting', label_es: 'Reunión comunitaria' },
  teach_in: { icon: '📚', label_en: 'Teach-in', label_es: 'Charla educativa' },
  vigil: { icon: '🕯️', label_en: 'Vigil', label_es: 'Vigilia' },
  commemoration: { icon: '🌹', label_en: 'Commemoration', label_es: 'Conmemoración' },
  skill_share: { icon: '🛠️', label_en: 'Skill share', label_es: 'Taller' },
  clinic: { icon: '⚕️', label_en: 'Clinic', label_es: 'Clínica' },
  direct_action: { icon: '🔥', label_en: 'Direct action', label_es: 'Acción directa' },
  cultural_event: { icon: '🎭', label_en: 'Cultural event', label_es: 'Evento cultural' },
  free_public_program: { icon: '🎟️', label_en: 'Free program', label_es: 'Programa gratuito' },
  community_market: { icon: '🛒', label_en: 'Community market', label_es: 'Mercado' },
  block_party: { icon: '🎉', label_en: 'Block party', label_es: 'Fiesta de barrio' },
  other: { icon: '📍', label_en: 'Other', label_es: 'Otro' },
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
  color: string;
  label_en: string;
  label_es: string;
  default_ttl_minutes: number;
  applicable_cities: string[];
}> = {
  ice_presence: { icon: '🛑', color: '#dc2626', label_en: 'ICE presence', label_es: 'Presencia de ICE', default_ttl_minutes: 240, applicable_cities: ['nyc'] },
  police_presence: { icon: '👮', color: '#ea580c', label_en: 'Police presence', label_es: 'Presencia policial', default_ttl_minutes: 120, applicable_cities: ['nyc', 'guatemala_city'] },
  route_change: { icon: '↪️', color: '#ca8a04', label_en: 'Route change', label_es: 'Cambio de ruta', default_ttl_minutes: 180, applicable_cities: ['nyc', 'guatemala_city'] },
  counter_protest: { icon: '⚠️', color: '#b91c1c', label_en: 'Counter-protest', label_es: 'Contra-manifestación', default_ttl_minutes: 120, applicable_cities: ['nyc', 'guatemala_city'] },
  dispersal_warning: { icon: '🚨', color: '#991b1b', label_en: 'Dispersal warning', label_es: 'Aviso de dispersión', default_ttl_minutes: 60, applicable_cities: ['nyc', 'guatemala_city'] },
  disinfo: { icon: '❓', color: '#7c3aed', label_en: 'Possible disinfo', label_es: 'Posible desinformación', default_ttl_minutes: 1440, applicable_cities: ['nyc', 'guatemala_city'] },
  medical_aid: { icon: '➕', color: '#16a34a', label_en: 'Medical aid', label_es: 'Punto de auxilio', default_ttl_minutes: 360, applicable_cities: ['nyc', 'guatemala_city'] },
  safe_space: { icon: '🏠', color: '#0891b2', label_en: 'Safe space', label_es: 'Espacio seguro', default_ttl_minutes: 480, applicable_cities: ['nyc', 'guatemala_city'] },
  supplies_needed: { icon: '📦', color: '#2563eb', label_en: 'Supplies needed', label_es: 'Se necesitan suministros', default_ttl_minutes: 360, applicable_cities: ['nyc', 'guatemala_city'] },
  signup_full: { icon: '🚫', color: '#6b7280', label_en: 'Signup full', label_es: 'Cupo lleno', default_ttl_minutes: 1440, applicable_cities: ['nyc', 'guatemala_city'] },
  transport_offer: { icon: '🚗', color: '#0d9488', label_en: 'Transport offered', label_es: 'Transporte disponible', default_ttl_minutes: 240, applicable_cities: ['nyc', 'guatemala_city'] },
  other: { icon: '📍', color: '#6b7280', label_en: 'Other', label_es: 'Otro', default_ttl_minutes: 120, applicable_cities: ['nyc', 'guatemala_city'] },
};

export const CITIES = {
  nyc: {
    display_name: 'New York City',
    country: 'US',
    default_language: 'en' as const,
    center: { lat: 40.7128, lng: -74.0060 },
    timezone: 'America/New_York',
  },
  guatemala_city: {
    display_name: 'Ciudad de Guatemala',
    country: 'GT',
    default_language: 'es' as const,
    center: { lat: 14.6349, lng: -90.5069 },
    timezone: 'America/Guatemala',
  },
};
