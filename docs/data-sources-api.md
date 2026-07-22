# Data Sources API

A reference for every data source Billion can access, the TypeScript function to call for each, and what it returns. Intended for teammates working on article generation, app redesign, or any feature that needs civic data without reading through scraper/adapter code.

All live-API functions come from `@acme/api`. Scrapers run as CLI jobs in `apps/scraper` and populate the database — they are not callable at request time.

---

## Quick index

| Category                                                | What you get                                           | Import                |
| ------------------------------------------------------- | ------------------------------------------------------ | --------------------- |
| [Ballot & elections](#ballot--elections)                | Contests, candidates, polling places, ballot measures  | `@acme/api`           |
| [Ballot-measure enrichment](#ballot-measure-enrichment) | Summaries, fiscal impact, pro/con arguments, citations | `@acme/api`           |
| [State legislation](#state-legislation)                 | CA bills, legislators, votes                           | `@acme/api`           |
| [Local government](#local-government)                   | City/county meetings, ordinances, votes                | `@acme/api`           |
| [CA election results](#ca-election-results)             | Statewide vote counts (live JSON feed)                 | `@acme/api`           |
| [Address autocomplete](#address-autocomplete)           | Street-address suggestions + place details             | `@acme/api`           |
| [Corpus content (DB)](#corpus-content-db)               | Bills, court cases, government content articles        | tRPC `content` router |
| [Scrapers (background jobs)](#scrapers-background-jobs) | Congress bills, SCOTUS, Federal Register, LAO, CA SOS  | `apps/scraper` CLI    |

---

## Ballot & elections

**Source:** Google Civic Information API  
**Entry point:** `packages/api/src/lib/civic.ts`  
**Auth:** `GOOGLE_CIVIC_API_KEY`  
**Rate limit:** 25,000 req/day free

> ⚠️ **The Representatives API was turned down by Google on April 30, 2025.** Only the **Elections** endpoints (`elections`, `voterinfo`, results) remain live — those power `getElections` / `getVoterInfo` and the whole enrichment pipeline, and are the only Civic functions the app consumes. The old `getRepresentatives` / `getRepresentativesEnriched` functions (which called the dead `/representatives` endpoint and were unused by any screen) have been **removed**. A replacement "your elected officials" lookup — Open States for legislators, Legistar for local, OCD-IDs via the still-live Divisions API for address→district — is tracked as a roadmap feature in [issue #123](https://github.com/billion-app/billion/issues/123). See `docs/civic-data-sources.md`.

```ts
import {
  getDistrictElectionResults,
  getElectionResults,
  getElections,
  getVoterInfo,
} from "@acme/api";

// Or, for direct tRPC consumption:
// civic.getVoterInfo({ address, electionId })
```

| Function                                    | Args                               | Returns                                                                       |
| ------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `getElections()`                            | —                                  | `Election[]` — all elections Google knows about                               |
| `getVoterInfo(address, electionId)`         | street address string, election ID | `VoterInfoResponse` — contests, polling places, drop boxes, enriched measures |
| `getElectionResults(stateFips, countyFips)` | FIPS codes                         | CA SOS results for the matching jurisdiction                                  |
| `getDistrictElectionResults(districtRef)`   | `DistrictRef`                      | narrowed by district                                                          |

**`getVoterInfo` runs the full enrichment pipeline** — ballot measures come back with summaries, fiscal impact, pro/con arguments, and per-field citations from the cross-validation engine. The raw Google Civic response alone omits nearly all content fields; this is what fills them.

Key return types (all exported from `@acme/api`):

- `Contest` — a race or measure on the ballot (includes enriched `CanonicalMeasure` fields when present)
- `Candidate` — name, party, photo, channels, incumbency, Vote Smart bio
- `PollingLocation` — address, hours, type
- `MeasureCitationRef` / `MeasureArgumentRef` — light serializable shapes used in the tRPC response

---

## Ballot-measure enrichment

**Source:** cross-validation engine pulling from 7 sources  
**Entry point:** `packages/api/src/lib/measure-crossvalidate.ts`  
**Auth:** `VOTE_SMART_API_KEY` (optional — Vote Smart adapter skips if absent)  
**When to call directly:** when you need enriched measure data outside the `getVoterInfo` flow — e.g. article generation, batch enrichment scripts

```ts
import type {
  CanonicalMeasure,
  MeasureCitation,
  MeasureSourceData,
  SourceTier,
} from "@acme/api";
import type { CanonicalMeasure } from "@acme/api/lib/measure-sources/types";
import { crossValidateMeasure, SOURCE_TIER_RANK } from "@acme/api";
// or via the named subpath:
import { crossValidateMeasure } from "@acme/api/lib/measure-crossvalidate";

const result: CanonicalMeasure = await crossValidateMeasure(
  {
    title: "Proposition 1",
    subtitle: "...", // optional — Google Civic's own text, used as last-resort
    text: "...",
    url: "...",
  },
  {
    stateAbbrev: "CA",
    county: "Santa Clara",
    electionYear: 2024,
  },
);
```

`CanonicalMeasure` fields:

| Field                  | Type                    | Notes                                                                            |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `title`                | `string`                | Measure title (passed through)                                                   |
| `summary`              | `string \| undefined`   | Best available summary; cite `citations` for the source                          |
| `summaryShort`         | `string \| undefined`   | One-sentence card preview                                                        |
| `summaryLong`          | `string \| undefined`   | Fuller detail-screen paragraph                                                   |
| `summaryIsAiGenerated` | `boolean`               | True when AI grounded on fetched text — UI should label it                       |
| `fiscalImpact`         | `string \| undefined`   | Official fiscal analysis (LAO for CA props, else Ballotpedia)                    |
| `fullText`             | `string \| undefined`   | Full measure text when available                                                 |
| `fullTextUrl`          | `string \| undefined`   | Link to the official text                                                        |
| `proArguments`         | `MeasureArgument[]`     | Attributed pro arguments                                                         |
| `conArguments`         | `MeasureArgument[]`     | Attributed con arguments                                                         |
| `citations`            | `MeasureCitation[]`     | One entry per populated field — `{field, sourceName, sourceUrl, tier, official}` |
| `discrepancies`        | `string[] \| undefined` | Fields where top-2 sources disagreed; for human review                           |

**Sources wired into the engine** (in trust-tier order):

| Source                      | Tier           | Scope                                             |
| --------------------------- | -------------- | ------------------------------------------------- |
| CA SOS Official Voter Guide | `state_sos`    | CA statewide props — AG summary, official pro/con |
| CA LAO Fiscal Analyses      | `state_sos`    | CA statewide props — nonpartisan fiscal impact    |
| LWV / CaVotes               | `lwv`          | CA statewide props — nonpartisan pros & cons      |
| Ballotpedia                 | `ballotpedia`  | Statewide + local lettered measures (all states)  |
| Wikipedia                   | `wikipedia`    | CA statewide props — encyclopedic overview        |
| Vote Smart                  | `vote_smart`   | State-level measures — summary + pro/con URLs     |
| Google Civic                | `google_civic` | The original input — lowest trust, always present |

When no human source has a summary, the engine falls back to grounded AI (SPUR Bay Area voter guide as source text), flagged `summaryIsAiGenerated: true`.

---

## State legislation

**Source:** Open States API v3  
**Entry point:** `packages/api/src/clients/open-states.ts`  
**Auth:** `OPEN_STATES_API_KEY`  
**Scope:** California state bills and legislators (expandable to other states)

```ts
import type {
  GetBillsOptions,
  OpenStatesBill,
  OpenStatesPerson,
} from "@acme/api";
import {
  getBillDetails,
  getBills,
  getBillsBySponsor,
  getCurrentSessions,
  getLegislatorById,
  getLegislators,
  getVotes,
  openStatesClient,
} from "@acme/api";
// or
import { getBills } from "@acme/api/clients/open-states";

const bills = await getBills({
  state: "ca",
  session: "20232024",
  query: "housing",
});
const detail = await getBillDetails("ocd-bill/...");
const legislators = await getLegislators({ state: "ca" });
```

| Function                      | What it returns                                               |
| ----------------------------- | ------------------------------------------------------------- |
| `getBills(opts)`              | `OpenStatesBillSearchResult[]` — paginated bill search        |
| `getBillDetails(billId)`      | `OpenStatesBill` — full bill with actions, sponsors, versions |
| `getLegislators(opts)`        | `OpenStatesPerson[]` — legislators matching the query         |
| `getVotes(billId)`            | `OpenStatesVote[]` — roll-call votes for a bill               |
| `getCurrentSessions(state)`   | Active legislative sessions                                   |
| `getBillsBySponsor(personId)` | Bills sponsored by a legislator                               |
| `openStatesClient`            | Raw client for custom queries                                 |

---

## Local government

**Sources:** persisted local-government records plus the Legistar Web API
**Entry points:** `packages/api/src/lib/local-government.ts`, `packages/api/src/integrations/legistar.ts`
**Auth:** None (public API)  
**Persisted jurisdictions:** Cedar Park (`cedar-park-tx`), Durham County
(`durham-county-nc`), and Kansas City (`kansas-city-mo`); live provider-specific
Legistar jurisdictions: San Jose, Santa Clara County, Sunnyvale

The product-facing reader uses normalized persisted records. Scheduled source
adapters populate these from official systems; Kansas City uses the structured
Legistar feed for current-term Council body `138`:

```ts
import {
  getLocalGovernmentMeeting,
  getLocalGovernmentMeetings,
} from "@acme/api";

const meetings = await getLocalGovernmentMeetings({
  jurisdiction: "kansas-city-mo",
  limit: 20,
});
const detail = meetings[0]
  ? await getLocalGovernmentMeeting(meetings[0].id)
  : null;
```

The equivalent tRPC procedures are `localGovernment.meetings` and
`localGovernment.meeting`. Detail includes official/versioned documents,
agenda items, motions, outcomes, tally text, and named votes when published.

Legistar remains available as a provider-specific live client:

```ts
import type { LegistarMatter, LegistarMeeting, LegistarVote } from "@acme/api";
import { JURISDICTIONS, legistar, LegistarClient } from "@acme/api";
// or
import { legistar } from "@acme/api/integrations/legistar";

const meetings = await legistar.getMeetings("sanjose", { upcoming: true });
const matters = await legistar.getMatters("santaclara", { keywords: "budget" });
const votes = await legistar.getVotes("sanjose", matterId);
```

| Method                                            | Returns                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `legistar.getMeetings(jurisdiction, opts?)`       | `LegistarMeeting[]` — council meetings with agendas |
| `legistar.getMatters(jurisdiction, opts?)`        | `LegistarMatter[]` — ordinances, resolutions, items |
| `legistar.getVotes(jurisdiction, matterId)`       | `LegistarVote[]` — how each member voted            |
| `legistar.getBodies(jurisdiction)`                | `LegistarBody[]` — committees and boards            |
| `legistar.getAttachments(jurisdiction, matterId)` | `LegistarAttachment[]` — PDFs, staff reports        |

To add a city: add its `*.legistar.com` subdomain to `JURISDICTIONS` in `integrations/legistar.ts`.

### Provider-neutral local meetings

- **Source:** [City of Durham OnBase Agenda Online](https://cityordinances.durhamnc.gov/OnBaseAgendaOnline/)
- **Reader:** `packages/api/src/lib/local-government.ts`
- **tRPC:** `localGovernment.meetings`, `localGovernment.meeting`

The Durham, Cedar Park, and Kansas City scrapers persist meetings, agenda or
minutes item outlines, supporting-document URLs, and official action/vote text.
The reader is provider-neutral and serves only cached database records; it does
not contact upstream meeting systems in the request path.

```ts
const meetings = await getLocalGovernmentMeetings({
  jurisdiction: "durham-nc",
});
const meeting = await getLocalGovernmentMeeting(meetings[0].id);
```

---

## CA election results

**Source:** CA Secretary of State `media.sos.ca.gov` (keyless JSON feed)  
**Entry point:** `packages/api/src/clients/ca-sos-results.ts`  
**Auth:** None

```ts
import type { ElectionContestResult, ResultCandidate } from "@acme/api";
import { SOS_RESULTS_HOME } from "@acme/api";
// or
import { SOS_RESULTS_HOME } from "@acme/api/clients/ca-sos-results";
```

`SOS_RESULTS_HOME` is the base URL constant for constructing result-feed URLs. The actual fetching is done server-side through the `civic` tRPC router's `getElectionResults` / `getDistrictElectionResults` procedures, which call `getElectionResults()` and `getDistrictElectionResults()` from `@acme/api`.

---

## Address autocomplete

**Source:** Google Places API (New)  
**Entry point:** `packages/api/src/lib/places.ts`  
**Auth:** `GOOGLE_PLACES_API_KEY` (falls back through `GOOGLE_API_KEY` → `GOOGLE_CIVIC_API_KEY`)

```ts
import type { AddressSuggestion } from "@acme/api";
import { getAddressSuggestions, getPlaceDetails } from "@acme/api";

const suggestions = await getAddressSuggestions("123 Main St");
const details = await getPlaceDetails(suggestions[0].placeId);
// details.formattedAddress, details.location (lat/lng)
```

Uses session-token billing — each autocomplete→select flow is one billed session, not one request per keystroke.

---

## Corpus content (DB)

Scraped articles stored in PostgreSQL. Accessed via the `content` tRPC router — not direct function imports, because these are DB queries that belong in the server layer.

**tRPC procedures:**

```ts
// In a tRPC caller context:
const all = await trpc.content.getAll.query();
const item = await trpc.content.getById.query({ id: "...", type: "bill" });
const typed = await trpc.content.getByType.query({ type: "court_case" });
```

`ContentCard` shape (returned by all three procedures):

| Field           | Type                                             |
| --------------- | ------------------------------------------------ |
| `id`            | `string`                                         |
| `title`         | `string`                                         |
| `description`   | `string \| null`                                 |
| `type`          | `"bill" \| "court_case" \| "government_content"` |
| `isAIGenerated` | `boolean`                                        |
| `thumbnailUrl`  | `string \| null`                                 |

`getThumbnailForContent(id, type)` is also exported from `@acme/api` for cases where only the thumbnail is needed.

**DB tables populated by scrapers:**

| Table               | Populated by                 | Content                                            |
| ------------------- | ---------------------------- | -------------------------------------------------- |
| `Bill`              | `congress.ts` scraper        | Federal bills, actions, sponsor, status, full text |
| `GovernmentContent` | `federalregister.ts` scraper | EOs, proclamations, presidential memos             |
| `CourtCase`         | `scotus.ts` scraper          | SCOTUS opinions via CourtListener                  |

---

## Scrapers (background jobs)

These run as CLI jobs (`bun run scrape -- --scrapers <name>`) in `apps/scraper` and are **not importable as functions at request time**. They populate `CivicApiCache` rows or DB tables that the live API reads.

| Scraper           | Populates                                     | Cadence                     |
| ----------------- | --------------------------------------------- | --------------------------- |
| `congress`        | `Bill` table                                  | Periodic                    |
| `federalregister` | `GovernmentContent` table                     | Periodic                    |
| `scotus`          | `CourtCase` table                             | Periodic                    |
| `vote411`         | `CivicApiCache` (VOTE411 voter guides)        | Pre-election                |
| `sccCvig`         | `CivicApiCache` (SCC county voter guide)      | Pre-election                |
| `caSosStatements` | `CivicApiCache` (CA SOS candidate statements) | Pre-election                |
| `caLaoFiscal`     | `CivicApiCache` (LAO fiscal analyses)         | Pre-election (~90 days out) |

**How the cache-warmer pattern works:** a scraper pre-fetches expensive HTML pages and stores structured JSON in `CivicApiCache`. When a user triggers `getVoterInfo`, the measure-source adapters read the cache row (sub-millisecond DB read) instead of doing a live HTML fetch inside the request. Cache TTL is 30 days for LAO; 24 hours for voter info responses.

---

## Adding a new data source

1. Write a source adapter (`packages/api/src/lib/measure-sources/<name>.ts`) returning `MeasureSourceData | null`.
2. Assign it a `SourceTier` from `measure-sources/types.ts`.
3. Register it in the `Promise.all` in `crossValidateMeasure` (`measure-crossvalidate.ts`).
4. If the source requires pre-warming, write a scraper in `apps/scraper/src/scrapers/<name>.ts` and register it in `apps/scraper/src/main.ts`.
5. Update `docs/civic-data-sources.md` and `docs/measure-enrichment.md`.

See `measure-sources/ca-lao-fiscal.ts` + `scrapers/ca-lao-fiscal.ts` as the canonical example of a cache-warmer-backed source.
