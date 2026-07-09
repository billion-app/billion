# @acme/scraper

Pulls in government content like bills, court cases, and White House content and saves it to the database. For new or changed content, it automatically generates an AI article and finds a thumbnail image.

## Scrapers

| File                   | Where data comes from             | How                                |
| ---------------------- | --------------------------------- | ---------------------------------- |
| `congress.ts`          | Congress.gov bills                | Official REST API                  |
| `federalregister.ts`   | Federal Register                  | Official REST API + HTML text      |
| `scotus.ts`            | Court opinions                    | CourtListener REST API             |
| `vote411.ts`           | VOTE411                           | Public voter-guide HTML            |
| `scc-cvig.ts`          | Santa Clara County voter guides   | PDF extraction + optional Gemini   |
| `ca-sos-statements.ts` | CA Secretary of State voter guide | Official candidate-statement pages |
| `ca-lao-fiscal.ts`     | CA Legislative Analyst's Office   | Proposition fiscal analyses        |
| `ca-vig-archive.ts`    | CA SOS voter-guide archive        | Historical proposition guide pages |

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

The scraper checks required values with Zod before starting network or database
work:

| Variable                                     | Required by                               | Why it matters                                                         |
| -------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `POSTGRES_URL`                               | Every registered scraper except `vote411` | Your Supabase/Postgres connection.                                     |
| `DEEPSEEK_API_KEY`                           | `federalregister`, `congress`, `scotus`   | Article, summary, image-keyword, and feed-copy generation.             |
| `CONGRESS_API_KEY`                           | `congress`                                | Free at [api.congress.gov/sign-up](https://api.congress.gov/sign-up/). |
| `BFL_API_KEY`                                | Optional                                  | FLUX feed images; raw content and AI text still persist without it.    |
| `COURTLISTENER_API_KEY`                      | Optional                                  | Higher CourtListener limits for `scotus`.                              |
| `GOOGLE_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` | Optional pair                             | Google Custom Search article thumbnails.                               |
| `GOOGLE_GENERATIVE_AI_API_KEY`               | Optional                                  | Gemini vision fallback for `scc-cvig` PDF extraction.                  |

See [the launch environment guide](../../docs/launch.md) for the complete
per-scraper matrix, provider setup links, defaults, and production guidance.

### 2. Run it

```bash
pnpm install
pnpm --filter @acme/scraper run start -- congress --concurrency 1
```

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
