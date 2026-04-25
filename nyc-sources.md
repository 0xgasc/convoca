# NYC Source Registry

Comprehensive seed list for the `sources` table, organized by borough. All sources here are ingested via consent-respecting methods — public APIs, RSS, ICS, Telegram public channels, public Mobilize/Action Network feeds. **No Instagram or Facebook scraping.** IG-only orgs are listed for awareness with `ingest_method: submission` so contributors can submit their content directly.

Insert script lives at `scripts/seed-nyc-sources.ts`.

---

## Citywide / Multi-Borough

### Civic action coalitions

| Display name | Ingest | URL | Notes |
|---|---|---|---|
| Hands Off NYC | `website_scrape` | https://www.handsoffnyc.com/calendar | Squarespace calendar; gentle scrape |
| Rise and Resist | `website_scrape` | https://www.riseandresist.org/calendar | Squarespace calendar |
| Extinction Rebellion NYC | `website_scrape` | https://www.xrebellion.nyc/events | Squarespace calendar |
| 350NYC | `rss` | https://350nyc.org/feed/ | WordPress RSS |
| New York Communities for Change | `rss` | https://www.nycommunities.org/feed | |
| Citizen Action of NY | `mobilize_api` | https://www.mobilize.us/citizenactionny/ | Public Mobilize feed |
| NYC-DSA | `action_network_rss` | https://actionnetwork.org/groups/new-york-city-dsa/feed | |
| Indivisible Brooklyn | `mobilize_api` | https://www.mobilize.us/indivisiblebrooklyn/ | |
| Indivisible Nation BK | `mobilize_api` | https://www.mobilize.us/indivisiblenationbk/ | |
| The Indypendent (protest calendar) | `rss` | https://indypendent.org/feed/ | Editorial weekly aggregator |

### Aggregators (peer projects — coordinate, don't compete)

| Display name | Ingest | URL | Notes |
|---|---|---|---|
| Mutual Aid NYC | `website_scrape` | https://mutualaid.nyc/mutual-aid-groups/ | Borough-organized directory; reach out re partnership |
| nyc-noise.com (community section) | `website_scrape` | https://nyc-noise.com/aid/ | Curated by genre/borough |
| actions.nyc | `website_scrape` | https://actions.nyc/ | NYC protests/mutual aid/community |
| protest.one (PROTEST_NYC) | `submission` | https://protest.one/calendar/ | They have a submit form too — natural collaboration |
| The Skint | `rss` | https://www.theskint.com/feed/ | Daily free/cheap NYC newsletter |
| doNYC | `rss` | https://donyc.com/free-events-nyc/feed/ | Free events curation |

### City government

| Display name | Ingest | URL | Notes |
|---|---|---|---|
| NYC Permitted Events | `nyc_open_data` | https://data.cityofnewyork.us/resource/tvpp-9vvx.json | All permitted public events; Socrata API, no auth |
| NYC Council Legistar | `legistar_api` | https://webapi.legistar.com/v1/nyc | All hearings, stated meetings, bills |
| nyc.gov public events | `rss` | https://www.nyc.gov/calendar.rss | City-published events |
| NYC Parks events | `website_scrape` | https://www.nycgovparks.org/events | Includes volunteer workdays citywide |

### Volunteer hubs

| Display name | Ingest | URL | Notes |
|---|---|---|---|
| NYC Service | `website_scrape` | https://www.nyc.gov/site/service/index.page | Volunteer opportunities citywide |
| NY Cares | `website_scrape` | https://www.newyorkcares.org/calendar | Login wall on signup but listings public |
| City Harvest | `rss` | https://www.cityharvest.org/feed/ | Food rescue volunteer days |
| Common Pantry | `rss` | https://commonpantry.org/feed/ | |
| GrowNYC | `rss` | https://www.grownyc.org/feed | Greenmarket + community programs |

### Library systems (RSS/ICS feeds available per branch)

| Display name | Ingest | URL | Notes |
|---|---|---|---|
| New York Public Library (Manhattan/Bronx/SI) | `rss` | https://www.nypl.org/help/rss-feeds | Per-branch RSS available |
| Brooklyn Public Library | `ics` | https://www.bklynlibrary.org/calendar | LibCal-style; ICS exportable per program |
| Queens Public Library | `rss` | https://www.queenslibrary.org/calendar | |

---

## Manhattan

| Display name | Ingest | Handle/URL | Cause/Type |
|---|---|---|---|
| Hell's Kitchen Fridge | `submission` | @hkfridge | Mutual aid |
| Cooper Square Committee | `rss` | https://coopersquare.org/feed | Tenant org |
| Met Council on Housing | `rss` | https://www.metcouncilonhousing.org/feed | Tenant org |
| Lower East Side People's FCU community programs | `website_scrape` | https://lespeoples.org/events | |
| West Side Campaign Against Hunger | `rss` | https://www.wscah.org/feed | Food security |
| Henry Street Settlement | `website_scrape` | https://www.henrystreet.org/events/ | Community programs |
| The People's Forum | `website_scrape` | https://peoplesforum.org/events/ | Free political programming |
| Verso Books events (LES) | `rss` | https://www.versobooks.com/events/feed | Free book talks/community programs |
| Community Boards M1-M12 | `ics` | https://www.nyc.gov/site/manhattancb1/calendar/calendar.page (etc.) | 12 community boards, monthly meetings |

## Brooklyn

| Display name | Ingest | Handle/URL | Cause/Type |
|---|---|---|---|
| Bushwick Ayuda Mutua | `submission` | @bushwickayudamutua | Mutual aid (IG-only) |
| Bed-Stuy Strong | `submission` | @bedstuystrong | Mutual aid |
| Crown Heights Mutual Aid | `submission` | @crownheightsaid | Mutual aid |
| Crown Heights Tenant Union | `rss` | https://crownheightstenantunion.org/feed | Tenant org |
| North Brooklyn Mutual Aid | `submission` | @nbkmutualaid | Mutual aid |
| Greenpoint Community Kitchen | `submission` | @greenpointcommunitykitchen | Mutual aid |
| Sunset Park Mutual Aid | `submission` | @wspmutualaid | Mutual aid (Spanish-bilingual) |
| Red Hook Initiative | `rss` | https://rhicenter.org/feed | Community org |
| Red Hook Mutual Aid | `submission` | @redhookmutualaid | Mutual aid |
| West Brooklyn Waterfront Mutual Aid | `submission` | @wbwmutualaid | Cobble Hill, Carroll Gardens, etc. |
| Equality for Flatbush | `submission` | @equality4flatbush | Tenant + housing |
| Gowanus Mutual Aid | `submission` | @gowanusmutualaid | Mutual aid |
| Clinton Hill Fort Greene Aid | `submission` | @chfgaid | Mutual aid |
| The People's Garden BK (Bushwick) | `submission` | @thepeoplesgardenbk | Garden/mutual aid |
| Clean Bushwick Initiative | `submission` | @clean_bushwick_initiative | Cleanups |
| Cleanup Crown Heights | `submission` | @cleanupcrownheights | Cleanups |
| Ridgewood Tenants Union (also serves Bushwick) | `rss` | https://ridgewoodtenants.org/feed | Tenant org |
| BPL — branch event feeds | `ics` | https://www.bklynlibrary.org/calendar | Per-branch ICS |
| Brooklyn Community Boards 1-18 | `ics` | https://www.nyc.gov/site/brooklyncb1/calendar (etc.) | 18 community boards |
| House of Yes (block parties + community shows) | `rss` | https://houseofyes.org/feed | Cultural events when free/community |
| Pioneer Works (free public programs) | `rss` | https://pioneerworks.org/feed | Arts |

## Queens

| Display name | Ingest | Handle/URL | Cause/Type |
|---|---|---|---|
| Astoria Mutual Aid Network | `submission` | @astoriamutualaid | Mutual aid |
| Sunnyside/Woodside Mutual Aid | `submission` | (community-curated) | Mutual aid |
| Woodside on the Move | `rss` | https://www.woodsideonthemove.org/feed | Community org |
| Jackson Heights MA / Queens MA Network | `submission` | (multiple IG handles) | Mutual aid |
| Forest Hills 112th Precinct Community Council | `website_scrape` | https://www.fh112council.org/events | Community org |
| Make the Road NY (Jackson Heights HQ + Bushwick + SI) | `rss` | https://maketheroadny.org/feed | Immigrant rights, multilingual |
| Voces Latinas | `website_scrape` | https://voceslatinas.org/events | Latina community programs |
| Queens Library — branch event feeds | `rss` | https://www.queenslibrary.org/calendar | Per-branch |
| Queens Community Boards 1-14 | `ics` | https://www.nyc.gov/site/queenscb1/calendar (etc.) | 14 community boards |
| Queens Botanical Garden volunteer days | `rss` | https://queensbotanical.org/feed | Volunteer |

## Bronx

| Display name | Ingest | Handle/URL | Cause/Type |
|---|---|---|---|
| South Bronx Mutual Aid | `submission` | @southbronxmutualaid | Mutual aid |
| Casa Bronx | `submission` | @casabronx | Southwest Bronx mutual aid |
| Mott Haven Mutual Aid | `submission` | (community-curated) | Mutual aid |
| Northwest Bronx Community & Clergy Coalition | `rss` | https://www.northwestbronx.org/feed | Tenant + community |
| The Friendly Fridge BX | `submission` | @thefriendlyfridgebx | Community fridge |
| The Neighborhood Fridge (Riverdale) | `submission` | @theneighborhoodfridge | Community fridge |
| Bronx Defenders community education | `rss` | https://www.bronxdefenders.org/feed | Know-your-rights clinics |
| BronxWorks events | `website_scrape` | https://bronxworks.org/news-events/events/ | Community programs |
| NYPL — Bronx Library Center + branches | `rss` | https://www.nypl.org/help/rss-feeds | Per-branch |
| Bronx Community Boards 1-12 | `ics` | https://www.nyc.gov/site/bronxcb1/calendar (etc.) | 12 community boards |
| Bronx River Alliance volunteer days | `rss` | https://bronxriver.org/feed | Volunteer cleanups |

## Staten Island

| Display name | Ingest | Handle/URL | Cause/Type |
|---|---|---|---|
| Staten Island Mutual Aid Network (FAM) | `submission` | (community-curated) | Mutual aid |
| Project Hospitality | `rss` | https://projecthospitality.org/feed | Food + housing services |
| Make the Road NY — Staten Island | `rss` | (shared with main MTRNY feed) | Immigrant rights |
| Snug Harbor Cultural Center community programs | `rss` | https://snug-harbor.org/feed | Cultural |
| Greenbelt Conservancy volunteer days | `rss` | https://sigreenbelt.org/feed | Volunteer cleanups |
| NYPL — Staten Island branches | `rss` | https://www.nypl.org/help/rss-feeds | Per-branch |
| Staten Island Community Boards 1-3 | `ics` | https://www.nyc.gov/site/sicb1/calendar (etc.) | 3 community boards |

---

## Coverage Summary (by ingestion method)

| Method | Source count (approx) | Setup effort |
|---|---|---|
| `nyc_open_data` (Permitted Events) | 1 endpoint, hundreds of events | 2 hours |
| `legistar_api` (NYC Council) | 1 endpoint, all hearings | 2 hours |
| `mobilize_api` | ~20 NYC orgs, dozens of events each | 3 hours |
| `action_network_rss` | ~10 NYC orgs | 1 hour |
| `rss` | ~30 org and library feeds | 4 hours (one adapter) |
| `ics` | NYC Council + ~60 community boards + library branches | 4 hours |
| `website_scrape` | ~10 calendar pages | 6 hours (one careful adapter per HTML structure) |
| `submission` | All IG-only orgs (community-fed) | Built once, scales forever |

For the hackathon, prioritize: **`nyc_open_data`, `legistar_api`, `mobilize_api`, `rss`, `ics`, `submission`** in that order. Skip `website_scrape` for V1 — too brittle for demo conditions.

## Coordination Opportunities

Several existing aggregators are aligned with Convoca's mission and could become partners or upstream sources rather than competitors:

- **mutualaid.nyc** — borough-organized directory, community-curated, active. Reach out about reciprocal links and possibly federating their group registry.
- **actions.nyc** — direct overlap. Either coordinate roadmaps or subsume their feed.
- **protest.one** — has a submit-event flow already. Likely interested in sharing infrastructure.
- **The Indypendent** — editorial NYC protest calendar. Their RSS is already public; consider proposing an embeddable Convoca widget.
- **BetaNYC** — civic-tech org running NYC School of Data + Open Data Week. Natural ally for OSS positioning. They run an annual hackathon (CityCamp NYC) where Convoca would fit.
- **NYC Open Data team (OTI)** — hosts annual Open Data Week. Possibly upstream for the city government feeds.

For the hackathon pitch, mention these by name as planned partnerships in the roadmap slide. It signals you understand the existing ecosystem and aren't trying to replace volunteer labor — you're trying to give it superpowers.

## Notes

- Telegram public channel ingestion is not in V1 because Guate sources need it more than NYC. Add when expanding seed data for Guate.
- Eventbrite API access is plausible for V1 if time permits; their public events search returns reasonable signal for NYC, but the API key application takes a few days to clear.
- For community boards, the city offers a master ICS feed at `https://www.nyc.gov/calendar.rss` that may cover most CB meetings — verify and use it instead of 59 individual feeds if so.
- All `submission`-method sources should still appear in the source registry so the Discovery agent knows about them and can suggest them to community members ("we know about Bushwick Ayuda Mutua but rely on community submissions for their content — submit a flyer here").
