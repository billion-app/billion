# Scraper Architecture Refactor

## Goal

Replace Crawlee with a hand-rolled approach to reduce complexity, dependencies, and learning surface while keeping reliability. The result is a simpler, more unified codebase where all scrapers follow the same patterns.

## What Changes

### Drop Crawlee + Playwright

Crawlee is only used by 2 of 4 scrapers (govtrack, whitehouse) for a pattern that amounts to: fetch HTML, parse with Cheerio, follow links. Replace with `fetch` + `cheerio` directly.

**Removed dependencies:** `crawlee`, `playwright`, `@apify/tsconfig`

### New: `src/utils/fetch.ts` — `fetchWithRetry()`

Single shared fetch utility (~30 lines). All four scrapers use this.

- Configurable max retries (default 3)
- Exponential backoff
- Honors `Retry-After` header
- Retries on 429 and 5xx
- Configurable timeout via `AbortSignal.timeout` (default 30s)
- Returns standard `Response`

### New: `src/utils/log.ts` — `log(scraperName, message)`

Thin wrapper over `console.log` that prefixes scraper name + timestamp. Replace all scattered `console.log`/`console.error` calls with this.

### Changed: `src/utils/db/operations.ts` — Unified `upsertContent()`

Merge `upsertBill()`, `upsertGovernmentContent()`, `upsertCourtCase()` into a single `upsertContent(type, data)` that switches on content type internally. DB schema stays the same (three separate tables). The shared logic:

1. Hash content
2. Check if exists + compare hash
3. Conditionally generate AI summary/article/thumbnail
4. Upsert to correct table
5. Generate video

### Changed: `src/scrapers/govtrack.ts` and `src/scrapers/whitehouse.ts`

Replace `CheerioCrawler` with direct `fetchWithRetry()` + `cheerio.load()`. Each scraper implements its own fetching pattern (listing page, pagination, detail pages) — no shared crawl abstraction, since the two are different enough that abstracting adds more complexity than it removes.

### Changed: `src/main.ts` — Runner loop

```ts
const scrapers: Scraper[] = [congress, govtrack, whitehouse, scotus]

const selected = parseArgs(process.argv)
for (const scraper of selected) {
  resetMetrics()
  await scraper.scrape()
  printMetricsSummary(scraper.name)
}
```

Each scraper conforms to:

```ts
type Scraper = {
  name: string
  scrape: (config?) => Promise<void>
}
```

Scrapers return `void` because they call `upsertContent()` as they go — no need to buffer all results in memory.

## What Stays the Same

- All AI generation (`src/utils/ai/`) — unchanged
- Google Images API (`src/utils/api/`) — unchanged
- Video operations (`src/utils/db/video-operations.ts`) — unchanged
- DB helpers (`src/utils/db/helpers.ts`) — unchanged
- Metrics (`src/utils/db/metrics.ts`) — unchanged
- Types and hash utilities — unchanged
- `retroactive-videos.ts` — unchanged
- DB schema (three separate tables) — unchanged

## File Structure

```
src/
├── main.ts                       # Runner: parse args, loop scrapers, print metrics
├── scrapers/
│   ├── congress.ts               # Congress.gov API
│   ├── govtrack.ts               # GovTrack HTML (fetch + cheerio)
│   ├── whitehouse.ts             # Whitehouse HTML (fetch + cheerio + turndown)
│   └── scotus.ts                 # CourtListener API
├── utils/
│   ├── types.ts
│   ├── hash.ts
│   ├── fetch.ts                  # NEW
│   ├── log.ts                    # NEW
│   ├── db/
│   │   ├── operations.ts         # CHANGED: unified upsertContent()
│   │   ├── video-operations.ts
│   │   ├── helpers.ts
│   │   └── metrics.ts
│   ├── api/
│   │   └── google-images.ts
│   └── ai/
│       ├── text-generation.ts
│       ├── image-generation.ts
│       ├── image-keywords.ts
│       └── marketing-generation.ts
├── retroactive-videos.ts
```

## Resumability

AI generation is already guarded by content hashing at the DB layer — unchanged content skips all AI calls. This means a crashed scraper can restart from scratch without re-running expensive AI generation. Fetch-level resumability (tracking visited URLs) is out of scope for now but could be added later by persisting a URL set to disk.

## Out of Scope

- DB schema changes (merging tables)
- Fetch-level resumability / URL persistence
- Structured/JSON logging
- New scraper sources
