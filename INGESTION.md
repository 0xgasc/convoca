# How Convoca Works: Community-Fed, Agent-Amplified

> This document is the basis for the public README intro and the `/about` page. It is the project's stated position on what we ingest, what we never will, and why.

## The shape of the problem

Civic and community life in cities like New York and Guatemala City generates a vast amount of organized IRL activity — protests, mutual aid distributions, town halls, volunteer cleanups, free public concerts, library readings, community board meetings, tenant union actions, food fridges, skill shares, vigils, block parties, teach-ins. The information about all of this exists. It's published by the people doing the work.

But it lives in dozens of disconnected places: Instagram stories, Telegram groups, Eventbrite, Mobilize, Action Network, neighborhood listservs, RSS feeds buried on org websites, government calendars in a half-dozen formats, physical flyers, and the WhatsApp group your friend's cousin runs. The result: people who actively care about civic and community life regularly miss things they would have shown up for, and organizers do enormous duplicate work trying to push their events into every channel.

A handful of remarkable human-curated aggregators exist (mutualaid.nyc, actions.nyc, protest.one, handsoffnyc, theskint, The Indypendent, nyc-noise, and others) and they prove the demand. They also depend on volunteer labor that doesn't scale. Convoca's job is to put reasoning agents underneath that work.

## Three principles

### 1. Consent-first ingestion

Convoca pulls events only from sources that have already chosen to publish openly:

- **Public APIs**: Mobilize, Action Network, Eventbrite, NYC Open Data, NYC Council Legistar
- **Open feeds**: RSS, ICS, Atom feeds published by orgs and city agencies
- **Public Telegram channels**: explicitly designed to be public broadcasts
- **Community submissions**: anything anyone hands us via `/submit`

We do not scrape Instagram, Facebook, or any logged-in platform. Their content is real and important — Bushwick Ayuda Mutua, Bed-Stuy Strong, South Bronx Mutual Aid, hundreds of others run primarily on Instagram — but those platforms have their own rules, and working around platform protections to extract organizing material puts the orgs we exist to serve at risk. The path for IG-only content is a community member tapping "Submit" and handing us the URL or screenshot. The agents process it instantly.

This isn't a technical limitation. It's a principled choice we'd make even if scraping were trivial.

### 2. Agents do labor, not surveillance

The agents inside Convoca read flyers, dedupe duplicate events across sources, classify causes, and rank events for individual users. They do five things they will never do:

1. **They do not profile users.** No demographic inference, no political scoring, no advertising graph.
2. **They do not build attendance lists.** We don't know who showed up to what, and we won't ask.
3. **They do not derive social graphs.** Who follows whom, who organizes with whom — none of that is computed or stored.
4. **They do not store location history.** Your real-time position is used to render the map and submit hyperlocal flags. It is not retained.
5. **They do not link sessions to identities.** The platform is session-based by design. If a state actor subpoenas us, we have nothing useful to give them.

Convoca is not a platform that uses civic engagement as a hook for data collection. It's a platform that uses agents to amplify civic engagement. The distinction is the entire point.

### 3. The community is the source

The most powerful ingest channel in Convoca is one tap from a community member. Drag a flyer, paste a URL, type an announcement — the vision and parsing agents extract structured event data within seconds, dedupe against existing entries, and add it to the map. The contributor sees the result and knows their submission worked.

This matters operationally because it means the platform scales with participation rather than against it. It matters politically because it puts agency in the right place: organizers and the people who care about their work are the source of truth about what's happening, not a centralized scraper.

## What this means for users

When you use Convoca, you should expect to see:

- Events from city government calendars and open data
- Events from orgs that have chosen to publish to Mobilize, Action Network, or Eventbrite
- Events from public Telegram channels and RSS feeds
- Events submitted by community members from anywhere — including IG, Facebook, WhatsApp, physical flyers

You should **not** expect Convoca to know about an event from a private group, a closed Facebook event, or an Instagram account that no community member has surfaced to us. If you see a gap, the answer is to submit it. That's not a bug — it's the design.

## What this means for organizers

If your work shows up in our public-API or public-feed sources, it will appear in Convoca automatically. If you run primarily on Instagram or another closed platform, your community can submit your events one at a time, or you can publish to a public feed (the easiest is creating a free Mobilize page) and we'll pick it up automatically.

We will never ask you for follower lists, email lists, or any data about the people who attend your events.

If you want to be removed from Convoca for any reason, email us and we will remove your sources within 24 hours, no questions asked. The request will not be logged in a way that links it to your identity.

## What this means for contributors

Convoca is open source under MIT (with AGPL on the safety/community-flagging modules under consideration). Anyone can:

- Run their own instance for their own city
- Add new source adapters
- Translate the interface
- Add their city to the official deployment
- Contribute to the agent prompts (which live in a single file, intentionally)

There is no plan to monetize Convoca with ads or to sell data. There is no data to sell.

## What this means for adversaries

We are aware that civic engagement platforms can be surveilled by state actors, doxxed by counter-protesters, or weaponized by harassment campaigns. Our threat model assumes all of the above. The architectural choices above — session-based, no persistent identity, no attendance data, no location history, AGPL on the moderation logic — are downstream of this threat model.

The community safety flagging system (real-time hyperlocal warnings about ICE presence, police, route changes, dispersal warnings, supplies needed) is the highest-risk surface in the platform. It runs through a Safety Review agent that filters spam and doxxing before any flag becomes public. Flags decay automatically. There is no public history of who reported what.

We will publish a more detailed threat model and a transparency report once we are operating beyond the hackathon stage.

## Why open source

A platform that says "trust us with your civic data" is asking for trust that no platform should be granted. The way to make claims like the ones above credible is to publish all of it: the schema, the prompts, the moderation logic, the ingestion adapters. That way anyone can verify what we claim, fork the project if they don't believe us, or run their own instance and never trust us at all.

Convoca is a piece of public infrastructure for IRL community life. It should be owned the same way.
