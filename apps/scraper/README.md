# @acme/scraper

Pulls in government content like bills, court cases, and White House content and saves it to the database. For new or changed content, it automatically generates an AI article and finds a thumbnail image.

## Active data sources

Only these five are registered and run by `all`:

| CLI name            | Source and data fetched                                                                    | Stored/used as                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `federalregister`   | Federal Register API presidential documents, then each document's body HTML                | `government_content`; AI article/summary and feed-image enrichment                                    |
| `congress`          | Congress.gov API bill list, detail, CRS summaries, formatted text, and legislative actions | `bill`; powers federal bill content and AI/feed enrichment                                            |
| `scotus`            | CourtListener opinion clusters, dockets, and sub-opinion text for the Supreme Court        | `court_case`; powers court content and AI/feed enrichment                                             |
| `scc-cvig`          | Hand-configured Santa Clara County voter-guide PDFs                                        | Candidate statements in `CivicApiCache`; the API matches statements to candidates                     |
| `ca-sos-statements` | California SOS statewide-office candidate-statement pages                                  | Candidate statements in `CivicApiCache`; the API reads the cache and can fall back to the live source |

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
| `DEEPSEEK_API_KEY`                           | `federalregister`, `congress`, `scotus` | Article, summary, image-keyword, and feed-copy generation.                                                         |
| `CONGRESS_API_KEY`                           | `congress`                              | Free at [api.congress.gov/sign-up](https://api.congress.gov/sign-up/).                                             |
| `BFL_API_KEY`                                | Optional                                | FLUX feed images; raw content and AI text still persist without it.                                                |
| `COURTLISTENER_API_KEY`                      | Optional                                | Higher CourtListener limits for `scotus`.                                                                          |
| `GOOGLE_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` | Optional pair                           | Google Custom Search article thumbnails.                                                                           |
| `GOOGLE_GENERATIVE_AI_API_KEY`               | Optional                                | Gemini vision fallback for `scc-cvig` PDF extraction.                                                              |

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
`dist/retroactive-lenses.js`, and the retroactive-video job to
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

| Variable                        | Default | Counts                                              |
| ------------------------------- | ------: | --------------------------------------------------- |
| `FEDERALREGISTER_MAX_ITEMS`     |      20 | Presidential documents                              |
| `CONGRESS_MAX_ITEMS`            |     100 | Bills                                               |
| `SCOTUS_MAX_ITEMS`              |      50 | CourtListener opinion clusters                      |
| `SCC_CVIG_MAX_ITEMS`            |      10 | Voter-guide PDF documents                           |
| `CA_SOS_MAX_ITEMS`              |       9 | Statewide-office candidate-statement pages          |
| `SCRAPER_MAX_NEW_ITEMS_PER_RUN` |      10 | New records receiving expensive AI/image enrichment |

These are per-run limits, not durable calendar-day quotas. Schedule one run per
day to obtain a daily cap. If the scheduler retries or runs multiple times, each
invocation gets a fresh allowance. Source limits cap API/page work;
`SCRAPER_MAX_NEW_ITEMS_PER_RUN` separately caps expensive enrichment while
still storing additional raw records for later backfill.

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

Set `SCRAPER_FORCE_AI_REGEN=1` to force a full AI refresh even when the record already has AI content.
