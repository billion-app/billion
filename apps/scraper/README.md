# @acme/scraper

Pulls in government content like bills, court cases, and White House content and saves it to the database. For new or changed content, it automatically generates an AI article and finds a thumbnail image.

## Active data sources

These data sources are registered and run by `all`:

| CLI name                 | Source and data fetched                                                                    | Stored/used as                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `federalregister`        | Federal Register API presidential documents, then each document's body HTML                | `government_content`; AI article/summary and feed-image enrichment                                    |
| `durham-bocc`            | Durham County's official Legistar API (current election cycle only)                        | Provider-neutral meetings, agenda items, actions, votes, and official document links; no AI required  |
| `congress`               | Congress.gov API bill list, detail, CRS summaries, formatted text, and legislative actions | `bill`; powers federal bill content and AI/feed enrichment                                            |
| `scotus`                 | CourtListener opinion clusters, dockets, and sub-opinion text for the Supreme Court        | `court_case`; powers court content and AI/feed enrichment                                             |
| `scc-cvig`               | Hand-configured Santa Clara County voter-guide PDFs                                        | Candidate statements in `CivicApiCache`; the API matches statements to candidates                     |
| `ca-sos-statements`      | California SOS statewide-office candidate-statement pages                                  | Candidate statements in `CivicApiCache`; the API reads the cache and can fall back to the live source |
| `ncsbe`                  | Current-cycle NCSBE candidate CSV, referendum PDFs, and result ZIPs                        | Provider-neutral election tables; powers `civic.getNcElectionData` with exact file provenance         |
| `texas-legislature`      | Texas Legislative Council anonymous FTP: current-session history XML and bulk documents    | State-aware `bill` rows; read through `content.texasBills` and `content.getById`                      |
| `missouri-legislature`   | Missouri House current-session XML exports                                                 | Shared state-aware `bill` rows; read through `content.stateBills` and `content.getById`               |
| `texas-current-election` | Texas SOS structured election feed and TLC amendment analyses                              | Current-cycle snapshots; powers `civic.getTexasCurrentElection` and measure enrichment                |
| `cedar-park-council`     | Cedar Park's CivicEngage City Council page and its official Municode Meetings embed        | Provider-neutral local meetings, documents, agenda items, motions, outcomes, and votes                |

`vote411`, `ca-lao-fiscal`, and `ca-vig-archive` remain under
`src/scrapers/disabled/` and do not run. Their caches had no application
consumer, so scheduling them only created unused data. See the disabled-folder
README for the requirements to revive them.

---

## Setup

### 1. Configure the scraper environment

From the repo root:

```bash
pnpm env:setup --target scraper --scraper congress --file .env
```

The wizard asks only for the selected scraper, explains each variable, and
links to its provider. Verify it without printing values:

```bash
pnpm env:doctor --target scraper --scraper congress --file .env
```

Each adjacent `*.config.ts` file declares that scraper's source and required,
recommended, and optional variables. The wizard and runtime validator consume
the same declaration, so adding a scraper does not require duplicating its
requirements in `@acme/env`. Zod validation runs before network or database
work:

| Variable                                     | Required by                             | Why it matters                                                                                                     |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_URL`                               | Every active scraper                    | Your Postgres connection. If inserting credentials manually, percent-encode only the username/password components. |
| `OPENROUTER_API_KEY`                         | `federalregister`, `congress`, `scotus` | Preferred provider for article, summary, image-keyword, feed-copy, and web-research generation.                    |
| `OPENROUTER_MODEL`                           | Optional                                | OpenRouter model slug; defaults to `deepseek/deepseek-v4-flash`.                                                   |
| `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL`     | Local fallback                          | OpenAI-compatible local text endpoint and model; the Big Mac deployment uses bounded-context Qwen.                 |
| `DEEPSEEK_API_KEY`                           | Deprecated fallback                     | Keeps direct DeepSeek generation working during the OpenRouter credential migration.                               |
| `CONGRESS_API_KEY`                           | `congress`                              | Free at [api.congress.gov/sign-up](https://api.congress.gov/sign-up/).                                             |
| `BFL_API_KEY`                                | Optional                                | FLUX feed images; raw content and AI text still persist without it.                                                |
| `LOCAL_FLUX_BASE_URL` / `LOCAL_FLUX_MODEL`   | Optional                                | Local FLUX HTTP fallback; the Big Mac deployment uses FLUX.2 Klein.                                                |
| `COURTLISTENER_API_KEY`                      | Optional                                | Higher CourtListener limits for `scotus`.                                                                          |
| `GOOGLE_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` | Optional pair                           | Google Custom Search article thumbnails.                                                                           |
| `GOOGLE_GENERATIVE_AI_API_KEY`               | Optional                                | Gemini vision fallback for `scc-cvig` PDF extraction.                                                              |
| `OPEN_STATES_API_KEY`                        | Optional                                | Adds an exact Open States bill ID when Texas or Missouri jurisdiction/session/identifier match.                    |

See [the launch environment guide](../../docs/launch.md) for the complete
per-scraper matrix, provider setup links, defaults, and production guidance.

### 2. Run it

```bash
pnpm install
pnpm --filter @acme/scraper run start congress --concurrency 1
```

### Production build

Build the Node ESM production artifacts from the repository root:

```bash
pnpm --filter @acme/scraper build
```

Vite writes the scraper CLI to `dist/main.js`, the dual-lens backfill to
`dist/retroactive-lenses.js`, the incomplete-content repair job to
`dist/reprocess-content.js`, the missing bill-description repair job to
`dist/backfill-bill-descriptions.js`, and the retroactive-video job to
`dist/retroactive-videos.js`. The build can also emit shared chunks; deploy the
whole `dist/` directory rather than copying only an entry file. Linked
`@acme/*` workspace source is included in the build, while normal third-party
packages remain runtime dependencies.

Start the production CLI with variables supplied by the container or scheduler:

```bash
node apps/scraper/dist/main.js congress --concurrency 1
```

### Backfill dual-lens perspectives

Generate missing or stale perspectives directly from stored content without
waiting for an upstream scraper to return each item again:

```bash
pnpm --filter @acme/scraper retroactive-lenses --type all --limit 10
pnpm --filter @acme/scraper retroactive-lenses --type bill --limit 1 --dry-run
```

The limit applies per selected content type. Processing is sequential to keep
AI cost and rate-limit behavior predictable.

The production entry does not load `.env` files or bake their values into the
bundle. Development commands continue to load the repository's local env files
as described in the [launch environment guide](../../docs/launch.md).

### Source and enrichment limits

`--max-items` caps source records fetched/processed by each selected scraper for
that run. It overrides the selected scraper's environment default:

```bash
# Process at most ten Congress.gov bills in this run
pnpm --filter @acme/scraper run start congress --max-items 10

# If scheduled once per day, this is effectively ten bills per day
CONGRESS_MAX_ITEMS=10 pnpm --filter @acme/scraper run start congress
```

| Variable                         | Default | Counts                                              |
| -------------------------------- | ------: | --------------------------------------------------- |
| `FEDERALREGISTER_MAX_ITEMS`      |      20 | Presidential documents                              |
| `CONGRESS_MAX_ITEMS`             |     100 | Bills                                               |
| `SCOTUS_MAX_ITEMS`               |      50 | CourtListener opinion clusters                      |
| `SCC_CVIG_MAX_ITEMS`             |      10 | Voter-guide PDF documents                           |
| `CA_SOS_MAX_ITEMS`               |       9 | Statewide-office candidate-statement pages          |
| `NCSBE_MAX_ITEMS`                |       4 | Current-cycle candidate/referendum/result files     |
| `TEXAS_LEGISLATURE_MAX_ITEMS`    |     100 | Bills from the latest Texas bulk session            |
| `MISSOURI_LEGISLATURE_MAX_ITEMS` |     100 | Changed bills from active Missouri sessions         |
| `TX_SOS_MAX_ITEMS`               |      12 | Current-cycle Texas SOS election payloads           |
| `CEDAR_PARK_COUNCIL_MAX_ITEMS`   |     100 | Council meetings (after the 12-month cutoff)        |
| `DURHAM_BOCC_MAX_ITEMS`          |     100 | Current-cycle Durham County BOCC meetings           |
| `SCRAPER_MAX_NEW_ITEMS_PER_RUN`  |      10 | New records receiving expensive AI/image enrichment |

These are per-run limits, not durable calendar-day quotas. Schedule one run per
day to obtain a daily cap. If the scheduler retries or runs multiple times, each
invocation gets a fresh allowance. Source limits cap API/page work;
`SCRAPER_MAX_NEW_ITEMS_PER_RUN` separately caps expensive enrichment. Extra
bills that require a generated description are deferred before insertion;
other content may still be stored raw for later backfill.

The NCSBE integration is intentionally current-cycle only and excludes voter
history plus candidate contact/address fields. See
[`docs/ncsbe-election-data.md`](../../docs/ncsbe-election-data.md) for discovery,
idempotency, provenance, API, and deterministic Civic-matching details.

## Cedar Park City Council (`civicengage.ts`)

Cedar Park's public site is CivicEngage, but the City Council records page now
embeds a keyless Municode Meetings publish page. The adapter follows that
official embed, keeps a 12-month Council-only window, downloads at most two
documents concurrently, and deterministically parses PDF text. AI/vision is not
used. Agendas, packets, minutes, and later document URLs are versioned beneath
one provider-neutral meeting record; unchanged reruns produce the same natural
keys and checksums.

```bash
pnpm --filter @acme/scraper run start cedar-park-council --max-items 1
```

To add a second CivicEngage jurisdiction using the same kind of official
Municode embed, add a `CivicEngageJurisdictionConfig` beside
`cedarParkCouncilSource` with its CivicEngage host/path, IANA timezone,
Municode `cid`/`ppid`, and governing-body matcher, then instantiate the same
discovery/parser pipeline. If its records page uses Agenda Center, Legistar, or
another provider, implement that provider behind the same local-government
persistence contract instead.

---

## Congress bills (`congress.ts`)

Uses the official [Congress.gov API](https://api.congress.gov) so no scraping. For each bill it fetches:

- Title, sponsor, status, and introduced date
- The CRS-written summary (so we don't need AI to generate one)
- Plain text of the bill (used for AI article generation)

```ts
await scrapeCongress({
  congress: 119, // which Congress (default: 119)
  chamber: "House", // "House" or "Senate" (default: "House")
  maxBills: 100, // how many bills to fetch (default: 100)
});
```

---

## Texas Legislature Online (`texas-legislature.ts`)

Uses only the Texas Legislative Council's anonymous FTP service at
`ftp.legis.state.tx.us`; it does not crawl interactive TLO bill pages. The job:

- discovers the newest session directory under `/bills` and rejects a stale
  `TEXAS_LEGISLATURE_SESSION` assertion (official codes look like `89R` or
  `892`);
- parses bill-history XML for identity, caption, sponsors, subjects, actions,
  structured votes when present, and document metadata;
- downloads bill text, analyses, and fiscal notes from the matching FTP bulk
  HTML paths and stores their extracted text alongside official HTML/PDF links;
- optionally stores an exact Open States ID without using Open States as the
  legislative data source.

Run a small current-session import:

```bash
pnpm --filter @acme/scraper run start texas-legislature --max-items 10
```

Apply `packages/db/migrations/add_state_legislation_fields.sql` before the first
run. The public `content.texasBills` procedure lists only the newest persisted
Texas session; `content.getById` returns its documents, actions, and votes. This
work deliberately does not provide historical-session browsing or backfills.

---

## Missouri General Assembly (`missouri-legislature.ts`)

Discovers the active regular and any enabled special sessions from the official
[`SessionSet.js`](https://documents.house.mo.gov/SessionSet.js); no session code
is configured or hard-coded. Each run observes
the House's no-more-than-once-per-30-minutes rule through a durable database
guard, fetches `BillList.XML`, and downloads only individual House bill XML rows
whose `LastTimeRun` changed. At most two bill XML requests run concurrently.

`SenateActList.XML` is also imported, but it is explicitly incomplete: it only
contains Senate bills with House activity. Their latest shared `bill.versions`
entry carries `changes = senate_with_house_actions_only`. Official actions, sponsors,
committees, proposed effective dates, roll-call totals, bill versions,
summaries, fiscal notes, amendments, veto letters, and witness documents are
stored in the shared `bill` contract. `OPEN_STATES_API_KEY` optionally adds an
exact identity match and is never required for official ingestion.

```bash
pnpm --filter @acme/scraper run start missouri-legislature --max-items 10
```

`content.stateBills({ stateCode: "MO" })` returns the active rows retained by
the latest official session descriptor; the scraper removes prior Missouri
sessions, so historical browsing is not provided.

Source format and coverage references: [XML export overview](https://documents.house.mo.gov/),
[BillList fields](https://documents.house.mo.gov/XMLBillList.html),
[individual bill fields](https://documents.house.mo.gov/XMLBillExports.html),
and [Senate bills with House actions](https://documents.house.mo.gov/XMLSenateBillsWithHouseActions.html).

---

## Court cases (`scotus.ts`)

Uses the [CourtListener API](https://www.courtlistener.com/api/) — free, works without a key. Fetches recent opinions and pulls in the plain-text opinion content for AI article generation.

```ts
await scrapeScotus({
  court: "scotus", // court ID (default: "scotus" = Supreme Court)
  maxCases: 50, // how many cases to fetch (default: 50)
});

// Other courts you can use:
// "ca9"  → 9th Circuit
// "ca2"  → 2nd Circuit
// "cadc" → D.C. Circuit
// Full list: https://www.courtlistener.com/api/rest/v4/courts/
```

---

## How upserts work

All scrapers call into `src/utils/db/operations.ts`. Each time a bill or case is processed:

- If it's **new** → saves it and generates an AI article + thumbnail
- If the **content changed** → regenerates the article
- If **nothing changed** → backfills any missing AI summary/article/thumbnail fields, otherwise skips AI generation

The Texas importer passes `skipEnrichment` so official source data is persisted
without AI summaries, generated imagery, or videos.

Set `SCRAPER_FORCE_AI_REGEN=1` to force a full AI refresh even when the record already has AI content.

For a new bill whose description must be generated, the summary is now created
before insertion. If every configured text provider fails, the insert fails and
the next scheduled scrape retries it instead of leaving a blank bill row.
