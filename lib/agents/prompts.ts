// lib/agents/prompts.ts
// All seven Convoca agent prompts. Centralized for easy iteration.
// Each prompt is exported as a function that takes typed params and returns
// the formatted string. Keep prompt logic out of agent implementation files.

import { CAUSE_VOCABULARY, EVENT_TYPES, ACTION_TYPES } from '@/lib/constants';

// =============================================================================
// 1. INTENT PARSE — turns free-text user prompts into structured filters
// =============================================================================

export const INTENT_PARSE_PROMPT = (params: {
  userMessage: string;
  city: 'nyc' | 'guatemala_city';
  currentDate: string; // ISO
  language: 'en' | 'es';
}) => `You parse a user's free-text request into structured filters for a civic
event discovery system.

City context: ${params.city}
Current date: ${params.currentDate}
User language: ${params.language}

User message:
"""
${params.userMessage}
"""

Extract intent. Return JSON only, no prose:
{
  "cause_tags": [string],          // from controlled vocab
  "event_types": [string],         // from controlled list
  "action_prefs": [string],        // "attend" | "rsvp" | "volunteer" | "donate"
  "date_range_start": "ISO" | null,
  "date_range_end": "ISO" | null,
  "neighborhood": string | null,
  "search_radius_km": number | null,
  "free_text_keywords": [string],  // for fallback semantic search
  "language_filter": "en"|"es"|"any",
  "reasoning": "1 sentence summary in ${params.language}"
}

Controlled cause vocab:
${CAUSE_VOCABULARY.join(', ')}

Controlled event_types:
${EVENT_TYPES.join(', ')}

Controlled action_prefs:
${ACTION_TYPES.join(', ')}

Resolve relative dates ("this weekend", "este sábado", "tonight") against the
current date. Default range to next 14 days if unspecified.`;

// =============================================================================
// 2. DISCOVERY — snowballs civic-relevant accounts from seeds
// =============================================================================

export const DISCOVERY_PROMPT = (params: {
  city: 'nyc' | 'guatemala_city';
  candidate: {
    handle: string;
    bio: string;
    recentPosts: string[];
    discoveredVia: string;
  };
}) => `You evaluate whether a social media account is relevant to civic
engagement organizing in ${params.city === 'nyc' ? 'New York City' : 'Guatemala City'}.

Civic-relevant accounts:
- Organize or amplify protests, marches, rallies, vigils, direct actions
- Coordinate volunteer opportunities (food distribution, cleanups, tutoring)
- Run mutual aid networks (supply drives, fund redistributions)
- Host town halls, public hearings, community meetings
- Provide hyperlocal community news with action items
- Organize labor actions, tenant organizing, immigrant defense
- Run skill shares, know-your-rights clinics, free schools

NOT civic-relevant:
- Personal accounts unless primarily about organizing
- Commercial brands using "community" as marketing
- National news outlets without hyperlocal organizing focus
- Influencer content about politics without organizing
- Religious institutions unless they run community programs

Candidate:
  Handle: ${params.candidate.handle}
  Bio: ${params.candidate.bio || '(empty)'}
  Discovered via: ${params.candidate.discoveredVia}
  Recent posts:
${params.candidate.recentPosts.map((p, i) => `  [${i + 1}] ${p.slice(0, 280)}`).join('\n')}

Return JSON only:
{
  "civic_relevance": 0.0-1.0,
  "source_type": [string],
  "primary_causes": [string],
  "language": "en"|"es"|"mixed",
  "reasoning": "1-2 sentences",
  "should_monitor": boolean
}

source_type options: protest_organizer, mutual_aid, volunteer_coord,
community_org, tenant_union, labor_org, immigrant_defense, news_local,
faith_community, cultural_org, other.

Set should_monitor true only if civic_relevance >= 0.6.`;

// =============================================================================
// 3. HARVESTER — Haiku-grade triage classifier
// =============================================================================

export const HARVESTER_PROMPT = (params: {
  postText: string;
  hasImage: boolean;
}) => `Classify whether this social media post is announcing or referencing a
specific upcoming civic event with date and location.

Post text:
"""
${params.postText}
"""

Has image attachment: ${params.hasImage}

Reply with exactly one word: "yes" or "no". No explanation.`;

// =============================================================================
// 4. VISION EXTRACTOR — the headline agent
// =============================================================================

export const VISION_PROMPT = (params: {
  city: 'nyc' | 'guatemala_city';
  currentDate: string; // ISO
  postText?: string;   // optional accompanying caption
}) => `You extract civic engagement event details from a flyer image. Flyers
vary wildly — professionally designed, hand-drawn, screenshots of text posts,
photos of physical posters. Most for ${params.city === 'nyc' ? 'NYC' : 'Guatemala City'}
will be in ${params.city === 'nyc' ? 'English, Spanish, or mixed' : 'Spanish, occasionally English or indigenous languages'}.

If a field is missing or ambiguous, set to null and explain in confidence_notes.
Never invent details. If the image is not a civic event flyer, set is_event=false
and stop.

City: ${params.city}
Current date (resolve relative dates against this): ${params.currentDate}
Reference timezone: ${params.city === 'nyc' ? 'America/New_York' : 'America/Guatemala'}
${params.postText ? `Accompanying caption:\n"""\n${params.postText}\n"""\n` : ''}
Return JSON only:
{
  "is_event": boolean,
  "title": string,
  "event_type": "protest"|"march"|"rally"|"town_hall"|"public_hearing"|"volunteer_opportunity"|"mutual_aid_distribution"|"community_meeting"|"teach_in"|"vigil"|"commemoration"|"skill_share"|"clinic"|"direct_action"|"cultural_event"|"other",
  "action_type": "attend"|"rsvp"|"register"|"bring_supplies"|"donate"|"amplify",
  "datetime_iso": "ISO-8601" | null,
  "datetime_text_raw": "exactly as written on the flyer",
  "end_datetime_iso": "ISO-8601" | null,
  "location_text": string,
  "location_specificity": "exact_address"|"landmark"|"neighborhood"|"vague"|"online",
  "organizer": string | null,
  "cause_tags": [string],
  "language": "en"|"es"|"mixed",
  "signup_url": string | null,
  "capacity": number | null,
  "supplies_needed": [string],
  "raw_text_extracted": string,
  "confidence": 0.0-1.0,
  "confidence_notes": string
}

Cause vocabulary (use only these):
${CAUSE_VOCABULARY.join(', ')}

Resolution rules:
- "this Saturday" / "este sábado" → resolve against current date
- "frente al Congreso" / "outside City Hall" → location_specificity: landmark
- "Zoom link in bio" / "online" → location_specificity: online
- If flyer says RSVP/register/cupos limitados → action_type: rsvp or register
- If flyer is a mutual aid distribution → event_type: mutual_aid_distribution, action_type: attend (unless capacity given)
- Bring-supplies events → action_type: bring_supplies, populate supplies_needed array

Output strictly valid JSON. No prose outside the object.`;

// =============================================================================
// 5. DEDUP — the showpiece reasoning agent
// =============================================================================

export const DEDUP_PROMPT = (params: {
  eventA: object;
  eventB: object;
  language: 'en' | 'es';
}) => `You judge whether two event records refer to the same real-world event.

Same-event signals:
- Datetime within 2 hours
- Location within ~500m or sharing a clear landmark
- Organizers overlap or are part of a known coalition
- Cause tags overlap significantly
- Same event_type or compatible (rally/march, town_hall/community_meeting)

Different-event signals:
- Different days
- Locations >2km apart
- Conflicting organizers with no coalition link
- Incompatible event_types (volunteer_opportunity vs protest)

EVENT_A:
${JSON.stringify(params.eventA, null, 2)}

EVENT_B:
${JSON.stringify(params.eventB, null, 2)}

Return JSON only:
{
  "same_event": boolean,
  "confidence": 0.0-1.0,
  "merge_strategy": "use_a"|"use_b"|"merge_fields"|null,
  "field_recommendations": {
    "title": "use_a"|"use_b"|"longer",
    "location_text": "use_a"|"use_b"|"more_specific",
    "organizer": "use_a"|"use_b"|"merge"
  },
  "reasoning_trace": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ]
}

reasoning_trace is shown to users as the agent's visible judgment process.
Write each step as one clear sentence in ${params.language}. Be specific, cite
the exact fields you compared.`;

// =============================================================================
// 6. RECOMMENDER — ranks events with user-facing reasoning
// =============================================================================

export const RECOMMENDER_PROMPT = (params: {
  userPrefs: {
    cause_prefs: string[];
    action_prefs: string[];
    neighborhood: string | null;
    language: 'en' | 'es';
  };
  events: Array<{
    id: string;
    title: string;
    event_type: string;
    action_type: string;
    datetime_iso: string;
    location_text: string;
    organizer: string;
    cause_tags: string[];
    distance_km: number | null;
  }>;
}) => `Rank civic events for a user based on stated preferences.

User preferences:
${JSON.stringify(params.userPrefs, null, 2)}

Events to rank:
${JSON.stringify(params.events, null, 2)}

For each event output a score 0.0-1.0 and a one-sentence reasoning written
directly to the user in ${params.userPrefs.language}.

Scoring guidance:
- Direct cause match: strong positive signal
- action_prefs alignment (e.g., user wants to volunteer, event is volunteer_opportunity): strong positive
- Geographic proximity: moderate positive (closer = better, < 2km is local)
- Time proximity: small positive (sooner = better, within preferred window)
- Penalize generic events that don't match any pref

Reasoning rules:
- Reference concrete prefs and event details, not "this matches your interests"
- 1 sentence, conversational, second person ("Te lo recomendamos porque..." / "We recommend this because...")
- If score < 0.4, include why it's still in results (e.g., "Outside your usual causes but happening in your neighborhood")

Return JSON only:
{
  "ranked": [
    {
      "event_id": string,
      "score": 0.0-1.0,
      "reasoning": string
    }
  ]
}

Sort descending by score.`;

// =============================================================================
// 7. SAFETY REVIEW — filter community flag submissions
// =============================================================================

export const SAFETY_REVIEW_PROMPT = (params: {
  flagType: string;
  note: string | null;
  city: string;
  reporterSessionAgeMinutes: number;
  similarFlagsFromSessionLastHour: number;
}) => `A community member submitted a real-time safety flag at a civic event
location. Filter spam, abuse, and coordinated disinformation before the flag
appears publicly. Real-time safety info has high value for attendees on the
ground — err toward approval when in doubt.

Submission:
  flag_type: ${params.flagType}
  note (optional, free text): ${params.note ? `"${params.note}"` : '(none)'}
  city: ${params.city}
  reporter session age: ${params.reporterSessionAgeMinutes} minutes
  similar flags from same session in past hour: ${params.similarFlagsFromSessionLastHour}

Approve if:
- Legitimate concern, even if uncertain or unverified
- Note is empty or contains generic safety info
- Flag type is plausible for the city (no ICE flags in Guatemala, etc.)

Block if:
- Clear spam (gibberish, ads, off-topic)
- Hate speech against any group
- Doxxing — names, addresses, photos of identifiable individuals
  EXCEPTION: public officials acting in their public capacity may be named
- Explicit instructions to harm others
- Looks like coordinated inauthentic behavior (rapid repeated submissions)

Send to human review if:
- Ambiguous between approve and block
- Contains personal info that should be redacted but flag is otherwise legitimate
- Specific accusations against named non-public individuals

Return JSON only:
{
  "decision": "approve"|"block"|"review",
  "reasoning": "1-2 sentences",
  "redacted_note": string | null
}

If you choose "review" and the note contains redactable PII, populate
redacted_note with a cleaned version. Otherwise null.`;
