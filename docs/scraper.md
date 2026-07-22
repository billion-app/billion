# Scraper Pipeline

## Overview

`apps/scraper/` is a standalone Node.js process. It runs on demand or on a schedule and writes **directly to the database** via `@acme/db` — no HTTP, no tRPC, no auth. It's a trusted server-side process; routing writes through tRPC would add latency, require tokens, and force write endpoints to be secured for no benefit.

Invoke via CLI: `pnpm start [scraper|all] [--concurrency N]` (default
concurrency 3, via `p-limit`). From the repo root, use
`pnpm --filter @acme/scraper run start [scraper] --concurrency N`. It ships
as a multi-stage `Dockerfile.scraper` (Node 22-slim). Vite builds the Node ESM
production entries, bundles linked workspace source, and leaves ordinary
runtime dependencies external for the production install. The container starts
the CLI with `node dist/main.js`; production configuration is read from the
process environment at runtime, not embedded during the build.

## Scrapers

| Scraper                     | Source                         | Content type               | Method                                                 |
| --------------------------- | ------------------------------ | -------------------------- | ------------------------------------------------------ |
| `congress.ts`               | congress.gov REST API          | `bill`                     | REST (`CONGRESS_API_KEY`), incremental by `updateDate` |
| `federalregister.ts`        | federalregister.gov REST API   | `government_content`       | REST; HTML→Markdown via Turndown                       |
| `scotus.ts`                 | CourtListener REST API         | `court_case`               | REST (`COURTLISTENER_API_KEY`, optional)               |
| `vote411.ts`                | vote411.org                    | (cached locally)           | cheerio HTML parse; does **not** write to the main DB  |
| `scc-cvig.ts`               | Santa Clara County voter guide | `civic_api_cache`          | PDF extraction; optional Gemini fallback               |
| `ca-sos-statements.ts`      | CA Secretary of State guide    | `civic_api_cache`          | official candidate-statement pages                     |
| `ca-lao-fiscal.ts`          | CA LAO ballot analyses         | `civic_api_cache`          | proposition fiscal analyses via HTML parse             |
| `ca-vig-archive.ts`         | CA SOS voter-guide archive     | `civic_api_cache`          | historical proposition guide pages via HTML parse      |
| `texas-current-election.ts` | Texas SOS + TLC                | `election_source_snapshot` | current-cycle JSON + deterministic PDF text parsing    |
| `texas-legislature.ts` | Texas Legislative Council FTP  | `bill`               | current-session XML + bulk HTML; no site mining         |

All HTTP goes through one `fetchWithRetry()` utility (`apps/scraper/src/utils/fetch.ts`): exponential backoff (1s/2s/4s…), `Retry-After` support (seconds or HTTP-date), 30s default timeout via `AbortController`, retriable on 429/5xx and `ECONNRESET`/`ECONNREFUSED`, plus a stateful **per-host backoff** that ramps on 429/5xx and relaxes on success.

> Note: `whitehouse.gov` cheerio scraping was replaced by the structured **Federal Register** REST API. `vote411-ballot.ts` exists for address-based ballot lookup (needs Playwright) but isn't wired into the CLI.

The Texas scraper is intentionally current-cycle only. SOS election facts and
TLC explanatory text remain separate provider snapshots and separate citations;
see [Texas current-election data](./texas-current-election.md).

## Upsert + Change Detection

`apps/scraper/src/utils/db/operations.ts` centralizes writes behind a discriminated-union `upsertContent(type, data)` (`type` ∈ bill | government_content | court_case). Each run:

1. Compute a SHA-256 over the type-specific key fields (title, summary, full text, status…).
2. Look up the existing row by its natural key (`(billNumber, sourceWebsite, legislativeSession)`, `url`, or `caseNumber`).
3. **Unchanged hash** → skip AI entirely; backfill only missing AI assets.
4. **New bill without a source description** → generate the required description first; defer the insert if source text or every provider is unavailable.
5. **New or changed** → run the remaining AI pipeline, upsert via `onConflictDoUpdate`, append to `versions`.

`SCRAPER_FORCE_AI_REGEN=1` overrides the cache. A `isUsableText()` gate refuses to feed AI any text under 200 chars or that's mostly blank/all-caps/single-word lines — keeps the model from "summarizing" garbage.

Texas is the provider-neutral state-bill extension to this flow. Its rows carry
an OCD jurisdiction, legislative session, subjects, sponsorships, documents,
votes, and an optional exact Open States ID. The scraper selects only the latest
FTP session and sets `skipEnrichment`; the API exposes only that newest session
through `content.texasBills`, with full supporting material in `content.getById`.

## AI Pipeline

Provider config lives in `apps/scraper/src/utils/ai/provider.ts`: text uses **OpenRouter** first, then an OpenAI-compatible local endpoint (`LOCAL_LLM_BASE_URL`, such as Ollama), with direct DeepSeek retained only as a deprecated last resort. PDF vision fallback uses **Gemini `gemini-2.5-flash`**. Images use hosted **Black Forest Labs FLUX.2 Klein 9B**, then `LOCAL_FLUX_BASE_URL` as a local fallback. Provider usage and hosted-image costs are tracked per run.

Each new/changed item runs through:

1. **Summary** (`text-generation.ts`) — ≤100-char punchy summary, 8th-grade reading level.
2. **Article** (`text-generation.ts`) — structured 4-section markdown: _What This Means For You_, _Overview_, _Impact & Implications_, _The Debate_; balanced across perspectives. Stored in `ai_generated_article`. Throws a typed `AIRateLimitError` on 429.
3. **Marketing copy** (`marketing-generation.ts`) — Zod-validated `{ title ≤25 chars, description ≤25 words, imagePrompt }` for the `video` feed card.
4. **Imagery** — multiple sources:
   - _Scraped thumbnail_ (preferred, free): source-provided image URL → `thumbnail_url`.
   - _Generated_: hosted FLUX.2 Klein 9B produces a 1024×1024 image, falling back to the configured local FLUX server at 768×768; `sharp` converts PNG→JPEG (q85); bytes land in the `image_data` `bytea` column. Hosted calls retry with backoff; moderation blocks return `null` silently.
   - _Stock-photo fallback_: `image-keywords.ts` → Google Custom Search (`GOOGLE_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`) can supply a thumbnail URL.

New bills that need an AI description generate it before the initial insert. A
provider outage therefore leaves the source item eligible for the next scrape
instead of persisting an incomplete bill that requires a manual repair.

## Pipeline Flow

The SHA-256 gate is the main cost control: unchanged content skips every AI call.

```mermaid
flowchart TD
    fetch["fetchWithRetry()<br/>(backoff, Retry-After, per-host throttle)"] --> hash["createContentHash()<br/>SHA-256 over key fields"]
    hash --> lookup["Look up existing row<br/>(natural key)"]
    lookup --> changed{"New or<br/>hash changed?"}

    changed -->|no| backfill["Backfill missing<br/>AI assets only"]
    changed -->|yes| usable{"isUsableText()?<br/>(≥200 chars, not boilerplate)"}
    usable -->|no| skipai["Upsert raw content,<br/>skip AI"]
    usable -->|yes| ai["AI pipeline (OpenRouter)"]

    ai --> summary["Summary (≤100 chars)"]
    summary --> article["Article (4-section markdown)<br/>→ ai_generated_article"]
    article --> marketing["Marketing copy<br/>(title ≤25, desc, imagePrompt)"]
    marketing --> img{"Scraped<br/>thumbnail?"}

    img -->|yes| thumburl["thumbnail_url"]
    img -->|no| flux["FLUX.2 Klein 9B → sharp JPEG<br/>→ image_data (bytea)"]
    flux -.->|moderation block / fail| stock["Google Custom Search<br/>stock thumbnail URL"]

    thumburl --> upsert["upsertContent()<br/>onConflictDoUpdate + append versions"]
    flux --> upsert
    stock --> upsert
    skipai --> upsert
    backfill --> upsert
    upsert --> video["generateVideoForContent()<br/>→ video feed row"]
```
