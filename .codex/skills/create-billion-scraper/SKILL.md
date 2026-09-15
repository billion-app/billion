---
name: create-billion-scraper
description: Add or reactivate a Billion source scraper, including typed persistence, source registration, bounded ingestion, and verification.
---

# Create a Billion scraper

Use repository-relative paths below from the checkout root. Read `AGENTS.md`,
`docs/scraper.md`, and `apps/scraper/README.md` before implementation. They own
the pipeline behavior, CLI flags, and operational limits.

## Choose the persistence path

Identify the source's stable identity, update timestamp, full source text, and
destination table before writing the adapter. Reuse an existing table when it
represents the same domain entity. A new source does not automatically need a
new table.

- Bills, presidential documents, and court cases: normalize into the types in
  `apps/scraper/src/utils/types.ts`, then call `upsertContent` from
  `apps/scraper/src/utils/db/operations.ts`. Follow `congress.ts`,
  `whitehouse.ts`, or `scotus.ts` under `apps/scraper/src/scrapers/`.
- Local decisions or source caches: use typed Drizzle queries with the shared
  `@acme/db/client` and tables from `@acme/db/schema`. Follow `legistar.ts` or
  `ca-sos-statements.ts` in that directory. Do not force cache records through
  article generation.
- A genuinely new entity: read `docs/data-layer.md`, define its Drizzle schema
  in `packages/db/src/schema.ts`, and follow the committed migration workflow.
  Derive persisted types and runtime validators from that schema.

Scrapers are trusted server processes and write through Drizzle. App consumers
read through tRPC. Do not add a direct `pg` client or raw SQL CRUD for scraper
records, including test fixtures. Use schema columns and typed query builders.
One-off repair and baseline scripts are not scraper conventions.

## Implement discovery and normalization

Keep fetching/parsing separable from persistence so fixtures can exercise source
behavior without writes or paid generation. Use the shared `fetchWithRetry` in
`apps/scraper/src/utils/fetch.ts`, or an existing source client when appropriate.

Preserve official URLs, complete source text, and source dates separately from
generated explanations. Distinguish filing dates from decision/publication
dates. Check natural keys and aliases against existing data so changing sources
does not duplicate records or break saved IDs. Do not silently truncate text or
report parser failures as an empty successful scrape.

For incremental feeds, use the source's update clock and durable cursors. Read
the cursor and retry sections of `docs/scraper.md`; a bounded newest-first scan
and an ascending historical walk have different completeness guarantees.

Read `docs/article-generation.md` when touching generated content. Preserve hash
reuse, stale-content invalidation, item budgets, and the `upsertContent` outcome
contract. Handle deferred work explicitly so it can be offered again. Avoid a
second generation path around the shared pipeline.

## Wire the source

Export a `Scraper` implementation and an adjacent `*.config.ts` environment
contract, following an adapter with the same persistence needs. Add the source
to `apps/scraper/src/scrapers.ts` and its environment contract to
`apps/scraper/src/scraper-contracts.ts`; an adapter file alone is inactive.

For new environment variables, read `docs/launch.md`, update the contract and
`packages/env/src/registry.ts` as appropriate, and run `pnpm env:example`.

If scheduled ingestion is part of the request, read `apps/supervisor/README.md`
and configure `apps/supervisor/src/config.ts` with explicit source, item,
concurrency, and generation limits. Registration alone does not schedule a
production job. State separately whether deployment has occurred.

## Verify and hand off

Use deterministic source fixtures to cover identity, dates, duplicate/revised
documents, and relevant source failures. Exercise the real persistence helper
when changing write behavior; seed, inspect, and clean up fixtures using typed
Drizzle queries. Scope cleanup to fixture IDs.

Before database writes, resolve the effective environment and report the target
host without credentials. Use a local test database and zero generation budget
where that proves the behavior. Live ingestion must select one source and an
explicit small item bound. Inspect current CLI flags: source limits and
generation budgets are separate, and the default `all` runs multiple sources.

Verify a representative record through the existing tRPC consumer when the task
requires app visibility. Read `docs/api.md` for API changes and
`docs/frontend.md` for UI changes. A parser test alone does not prove a record
appears in the app.

Run focused scraper checks and the applicable checks in `CONTRIBUTING.md`.
Update the CLI/source documentation. Report the source and storage path,
verification performed, and any unverified paid enrichment or deployment step.
