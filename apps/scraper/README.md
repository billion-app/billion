# Scraper CLI

The scraper collects government records and prepares the explanations the app reads. It writes directly to the selected database and can invoke paid providers. For the internal data flow, read [Scraper pipeline](../../docs/scraper.md). For production scheduling and deployment, read [Supervisor](../supervisor/README.md).

Commands below run from the repository root.

## Configure and run one source

```bash
pnpm env:setup --target scraper --scraper congress --file .env
pnpm env:doctor --target scraper --scraper congress --file .env
pnpm --filter @acme/scraper run start congress --max-items 1 --concurrency 1
```

Check the database target printed at startup. Local commands load root `.env.local` before `.env`, and existing process variables win. The doctor with `--file .env` validates that file; it does not prove a separate local override selects the same database. See [environment loading](../../docs/launch.md#loading-policy).

The first incremental Congress run starts at the beginning of the source feed. To inspect recent activity instead, use:

```bash
pnpm --filter @acme/scraper run start congress --recent 1 --concurrency 1
```

Source limits and generation budgets are different. `--max-items` limits source work in ordinary discovery; `--recent` selects a recent window. `SCRAPER_MAX_NEW_ITEMS_PER_RUN` limits items that generate assets, including existing records needing regeneration. Neither is a durable daily quota, and retry work has its own limits. Inspect `--help` and the source adapter before starting a larger job.

## Active sources

[The registry](src/scrapers.ts) defines what the CLI accepts and what `all` runs.

| CLI name                | Source                                                      | Destination                                    |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `whitehouse`            | White House presidential actions                            | `government_content`                           |
| `federalregister`       | Federal Register presidential documents                     | `government_content`                           |
| `legistar`              | San José meetings, matters, documents, and votes            | Normalized `local_*` tables                    |
| `congress`              | Congress.gov bills, text, summaries, and actions            | `bill`                                         |
| `open-states`           | State legislation through Open States                       | `bill`                                         |
| `scc-cvig`              | Santa Clara County voter-guide PDFs                         | Candidate statements in `civic_api_cache`      |
| `ca-official-guide`     | Date-scoped California official measure and candidate guide | Official guide records in `civic_api_cache`    |
| `ca-election-logistics` | California SOS election-specific key dates                  | Statewide voting guidance in `civic_api_cache` |
| `ca-sos-statements`     | California candidate-statement pages and PDF fallback       | Candidate statements in `civic_api_cache`      |

`all` starts registered scrapers concurrently and validates the whole set's environment first. It is broader than a production scheduled refresh. The supervisor names jobs separately so it can control timing, retention, and budgets.

`scotus.ts` is present but unregistered, so the current CLI does not accept `scotus`. Existing court content can still be read. Files under [scrapers/disabled](src/scrapers/disabled/README.md) are also inactive.

Each source declares its environment contract in an adjacent `*.config.ts`. Use those contracts and [the environment guide](../../docs/launch.md#scraper-and-scheduled-data-jobs) for required provider keys and current defaults.

## Build for production

```bash
pnpm --filter @acme/scraper build
node apps/scraper/dist/main.js congress --max-items 1 --concurrency 1
```

Vite writes Node ESM entries and shared chunks to `apps/scraper/dist/`. Deploy the whole directory and runtime dependencies. [vite.config.ts](vite.config.ts) lists the build entries; linked workspace source is bundled and third-party packages remain runtime dependencies.

Production entries read process variables and do not load local dotenv files. CI packages the build in `Dockerfile.scraper`; the [deployment guide](../supervisor/README.md) explains image pinning and the production host.

## Repair and backfill

Use the focused command for the missing asset. Check its help and preview mode first; write defaults differ by command.

| Command                      | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `reprocess-content`          | Inspect or repair incomplete content; read-only until `--apply`   |
| `backfill-bill-descriptions` | Fill missing bill descriptions; writes require `--apply`          |
| `repair-bill-descriptions`   | Repair misleading bill summaries through a reviewed manifest      |
| `retroactive-briefs`         | Generate missing or stale structured briefs; supports `--dry-run` |
| `retroactive-lenses`         | Generate missing or stale perspectives; supports `--dry-run`      |
| `content-images`             | Generate header artwork                                           |
| `bill-interest`              | Score editorial interest; supports `--dry-run`                    |
| `prune-bills`                | Inspect retention candidates; read-only until `--apply`           |

For example:

```bash
pnpm --filter @acme/scraper retroactive-lenses --type bill --limit 1 --dry-run
```

For a bounded bill-description repair, inspect first, then generate a manifest
for review and apply only that manifest. The command reads stored bill sources;
it does not call congress.gov or regenerate briefs, lenses, or images.

```bash
pnpm --filter @acme/scraper repair-bill-descriptions --source congress.gov --limit 100
pnpm --filter @acme/scraper repair-bill-descriptions --source congress.gov --limit 100 --generate --output /tmp/bill-description-repairs.json
pnpm --filter @acme/scraper repair-bill-descriptions --apply --manifest /tmp/bill-description-repairs.json --yes
```

Use repeatable `--id` for a targeted repair. Inventory is read-only; generation
requires an explicit output path, and production apply requires `--yes`.

[Maintenance and reprocessing](../../docs/scraper.md#maintenance-backfill--reprocessing-scripts) explains write gates, source recovery, and retention behavior. The source hash and each asset's cache determine whether a rerun needs generation. `SCRAPER_FORCE_AI_REGEN=1` bypasses reuse, so use it only for an intentional regeneration.

## Ballot source collection

`ca-official-guide` discovers the linked measure and candidate pages in the
California Secretary of State guide. It preserves official summaries, fiscal
impacts, published pro/con summaries, candidate statements and proposed-law PDF
links. Set `CA_GUIDE_ELECTION_DATE` to the exact election date. Every source page
must carry that date in its election banner. An incomplete bounded sample cannot
replace the stored collection. The source may omit statements for candidates
who did not submit one.

`ca-election-logistics` discovers upcoming California election pages and reads
their key-dates tables. It stores the published date wording and guidance with
links and retrieval time. It does not resolve a residential address or collect
assigned polling locations. The source table must match the election date in the
page URL, including its year.

Read-only previews make no database or model calls:

```bash
pnpm --filter @acme/scraper exec tsx src/scrapers/ca-official-guide-preview.ts 2026-11-03 1
pnpm --filter @acme/scraper exec tsx src/scrapers/ca-election-logistics-preview.ts https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026/key-dates-deadlines
```

After checking the database target and configuring the selected scraper, run:

```bash
CA_GUIDE_ELECTION_DATE=2026-11-03 pnpm --filter @acme/scraper start ca-official-guide
pnpm --filter @acme/scraper start ca-election-logistics --max-items 1
```

Both jobs use the existing civic cache table and invoke no AI. The supervisor
registers daily refreshes; deploying its configuration and populating the target
database are separate operational steps. Guide records expire after seven days;
voting guidance expires after one day. The guide schedule explicitly selects
November 3, 2026 and must be updated for another election.

The ballot API reads these records even when `includeEnrichment` is false. It
joins guide details only to provider-selected California statewide contests,
with an exact election date and unique measure number or candidate name/office.
It does not construct a person's ballot from a statewide roster. Each API read
checks source-cache expiry independently of the address lookup cache.

Coverage is California statewide guide content and statewide voting guidance.
County locations, statewide legislative-district statements and other states
remain outside these collectors. The Santa Clara CVIG scraper has only 2024
PDF discovery configured. Its year-scoped cache and the separate
`ca-sos-statements` cache are not used by this date-scoped ballot path.
