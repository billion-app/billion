# @acme/scraper

Pulls in government content like bills, court cases, and White House content and saves it to the database. For new or changed content, it automatically generates an AI article and finds a thumbnail image.

## Scrapers

| File | Where data comes from | How |
|---|---|---|
| `congress.ts` | Congress.gov bills | Official REST API |
| `govtrack.ts` | GovTrack bills | HTML scraping |
| `whitehouse.ts` | Whitehouse.gov | HTML scraping |
| `scotus.ts` | Court opinions | CourtListener REST API |

---

## Setup

### 1. Copy the env file

```bash
cp ../../.env.example .env
```

Then fill in the values. The ones you need for scraping:

| Variable | Required | Where to get it |
|---|---|---|
| `POSTGRES_URL` | ✅ | Your Supabase project settings |
| `OPENAI_API_KEY` | ✅ | [platform.openai.com](https://platform.openai.com) |
| `CONGRESS_API_KEY` | ✅ | Free at [api.congress.gov/sign-up](https://api.congress.gov/sign-up/) |
| `COURTLISTENER_API_KEY` | Optional | Free at [courtlistener.com](https://www.courtlistener.com/sign-in/) — only needed for higher rate limits |
| `GOOGLE_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` | Optional | For article thumbnail images |

### 2. Run it

```bash
pnpm install
pnpm dev
```

---

## Congress bills (`congress.ts`)

Uses the official [Congress.gov API](https://api.congress.gov) so no scraping. For each bill it fetches:

- Title, sponsor, status, and introduced date
- The CRS-written summary (so we don't need AI to generate one)
- Plain text of the bill (used for AI article generation)

```ts
await scrapeCongress({
  congress: 119,      // which Congress (default: 119)
  chamber: "House",   // "House" or "Senate" (default: "House")
  maxBills: 100,      // how many bills to fetch (default: 100)
});
```

---

## Court cases (`scotus.ts`)

Uses the [CourtListener API](https://www.courtlistener.com/api/) — free, works without a key. Fetches recent opinions and pulls in the plain-text opinion content for AI article generation.

```ts
await scrapeScotus({
  court: "scotus",  // court ID (default: "scotus" = Supreme Court)
  maxCases: 50,     // how many cases to fetch (default: 50)
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
- If **nothing changed** → skips AI generation entirely (saves API costs)