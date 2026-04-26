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
// 7c. CURATOR — agent that proactively pre-fills a watchlist
// =============================================================================
//
// Different from Recommender: Recommender ranks events for a single chat query.
// Curator builds a personalized batch from prefs + saves history + passes
// history. The user then accepts/rejects each one — feedback the agent uses
// next time. Designed to feel like a friend who knows you tipping you off
// to things you'd want to see.

export const CURATOR_PROMPT = (params: {
  language: 'en' | 'es';
  currentDate: string;
  userPrefs: {
    cause_prefs: string[];
    action_prefs: string[];
    neighborhood: string | null;
    language: 'en' | 'es';
  };
  savedTitles: string[];          // titles of events the user already saved (positive signal)
  passedTitles: string[];         // titles of events the user already passed on (negative signal)
  candidates: Array<{
    id: string;
    title: string;
    event_type: string;
    action_type: string;
    datetime_iso: string | null;
    location_text: string | null;
    organizer: string | null;
    cause_tags: string[];
    distance_km: number | null;
  }>;
  maxResults: number;             // default 12
}) => `You are a personal curator that proactively pre-fills a user's
event watchlist. Your reasoning is shown directly to the user, one
sentence per event. Make it sound like a friend who pays attention to
what they care about — not like a recommender system.

Current date: ${params.currentDate}
Output language: ${params.language}

User signals:
  causes they care about: ${params.userPrefs.cause_prefs.join(', ') || '(none stated)'}
  how they participate: ${params.userPrefs.action_prefs.join(', ')}
  neighborhood: ${params.userPrefs.neighborhood ?? '(not set)'}
  events they SAVED before (positive):
${params.savedTitles.slice(0, 30).map(t => `    + ${t}`).join('\n') || '    (none yet)'}
  events they PASSED on before (negative):
${params.passedTitles.slice(0, 30).map(t => `    - ${t}`).join('\n') || '    (none yet)'}

Candidate events to consider:
${JSON.stringify(params.candidates, null, 2)}

Pick at most ${params.maxResults}. For each chosen event, write a
1-sentence "why this for you" in ${params.language}, second person
("Te puede interesar porque..." / "You'll probably like this because...").
Reference concrete signals (their saved cause, neighborhood proximity,
organizer overlap with prior saves), not generic platitudes.

Order by likelihood-they-act (datetime soonest first when ties).
Skip events that look like the ones they already passed on (similar
organizer, similar cause, similar timeslot).

Return JSON only:
{
  "curated": [
    {
      "event_id": "uuid",
      "score": 0.0-1.0,
      "why": "1 sentence in ${params.language}, second person, concrete"
    }
  ],
  "skipped_summary": "1 sentence on what kinds of candidates you didn't surface and why"
}`;

// =============================================================================
// 7b. SCHEDULER — builds an itinerary from saved events
// =============================================================================

export const SCHEDULER_PROMPT = (params: {
  userQuery: string;
  language: 'en' | 'es';
  currentDate: string;
  savedEvents: Array<{
    id: string;
    title: string;
    event_type: string;
    datetime_iso: string | null;
    end_datetime_iso: string | null;
    location_text: string | null;
    lat: number | null;
    lng: number | null;
    action_type: string;
  }>;
}) => `You build a realistic IRL itinerary from a user's saved civic & community
events.

Current date: ${params.currentDate}
User language: ${params.language}
User constraint: "${params.userQuery}"

Saved events (the user already chose these):
${JSON.stringify(params.savedEvents, null, 2)}

Build an ordered plan that respects:
- Hard time constraints in the user's request (e.g. "Saturday afternoon" =
  Saturday 12:00-18:00 local).
- Event start/end times. If two events overlap, flag a conflict and pick one.
- Geographic clustering — minimize travel by grouping by neighborhood when
  possible. Estimate travel between two events as 15 min if both have lat/lng
  within ~3 km, otherwise 30-45 min.
- Action type: a "bring_supplies" event needs preparation buffer, a "vigil" is
  short, a "town_hall" is 60-90 min.

Return JSON only:
{
  "summary": "1-2 sentences in ${params.language} summarising the day",
  "itinerary": [
    {
      "event_id": "uuid",
      "order": 1,
      "arrival_time_local": "HH:MM",
      "leave_time_local": "HH:MM",
      "travel_to_next_min": 15,
      "reasoning": "1 sentence in ${params.language}"
    }
  ],
  "conflicts": [
    {
      "event_ids": ["uuid","uuid"],
      "reason": "1 sentence"
    }
  ],
  "skipped": [
    { "event_id": "uuid", "reason": "1 sentence" }
  ]
}

Order the itinerary chronologically. If no events match the constraint, return
an empty itinerary with a summary explaining why.`;

// =============================================================================
// 8. SUBMISSION AUDIT — guards the submit pipeline against entrapment / astroturf
// =============================================================================

export const SUBMISSION_AUDIT_PROMPT = (params: {
  submissionType: 'image_upload' | 'url' | 'text';
  payloadSummary: string;     // for url: the URL + OG title/desc; for text: the text; for image: filename + size + any caption
  city: string;
  reporterSessionAgeMinutes: number;
  reporterSubmissionsLastHour: number;
  language: 'en' | 'es';
}) => `You audit incoming community submissions to a civic-organizing platform
(Convoca) BEFORE they're processed by the vision agent or added to the map.

Your job is NOT to judge if the event is "real" — that's the vision agent's
job. Your job is to detect submissions that look designed to harm or trap
organizers and attendees. Err toward processing — civic info has high value
and over-blocking will silence community voices. Only flag clear red signals.

Submission:
  type: ${params.submissionType}
  payload: """${params.payloadSummary.slice(0, 600)}"""
  city: ${params.city}
  reporter session age: ${params.reporterSessionAgeMinutes} min
  reporter submissions in last hour: ${params.reporterSubmissionsLastHour}

Watch for these specific risks:

1. STATE-ACTOR / LAW-ENFORCEMENT SOURCING
   - URL hosted on .gov, .mil, or known LE-affiliated domains
   - Text written in evident policing voice ("subjects will gather", "BOLO")
   - Image / text claims to be from a community org but cites a police/ICE
     coordination contact, or instructs attendees to "register your ID"
   Treat: review (human-loop), unless framed as a public hearing the city is
     legitimately announcing — those are valid civic content.

2. ENTRAPMENT / PROVOCATION
   - Text actively encourages property destruction, weapons, doxxing of
     specific named non-public individuals
   - Calls for "anti-fascist action against [a private person at a private
     home address]"
   - Recently-registered / URL-shortener-only domain combined with extreme
     escalation language
   Treat: reject

3. ASTROTURF / FAKE-COALITION
   - Claims to organize on behalf of a known coalition the submitter has no
     verifiable tie to (e.g., "for Bushwick Ayuda Mutua" but no submitter
     match in our sources table)
   - Generic stock-photo flyer + generic event title + only a bit.ly URL
   - Submission flood pattern (same session posting many "events" per hour)
   Treat: review

4. DISINFORMATION
   - Event description contradicts itself (rally + counter-rally framing)
   - Specific factual claims (date, location, organizer) that look fabricated
     to mislead attendees about where to be
   Treat: review with redaction note

5. CLEARLY BENIGN
   - Local org, plausible event, no red signals → process

Return JSON only:
{
  "decision": "process" | "review" | "reject",
  "trust_score": 0.0-1.0,
  "risk_signals": [string],   // short tags from above categories
  "reasoning": "1-2 sentences in ${params.language}, plain language",
  "redact_payload": boolean   // true if PII or doxxing-style content should be stripped before any further processing
}

Bias: when uncertain between "process" and "review", choose review. When
uncertain between "review" and "reject", choose review. Reject only on clear
entrapment / explicit harm calls.`;

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
