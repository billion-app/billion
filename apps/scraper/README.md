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

| CLI name            | Source                                                | Destination                               |
| ------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `whitehouse`        | White House presidential actions                      | `government_content`                      |
| `federalregister`   | Federal Register presidential documents               | `government_content`                      |
| `legistar`          | San José meetings, matters, documents, and votes      | Normalized `local_*` tables               |
| `congress`          | Congress.gov bills, text, summaries, and actions      | `bill`                                    |
| `scotus`            | Supreme Court opinion and order-opinion indexes/PDFs  | `court_case`                              |
| `open-states`       | State legislation through Open States                 | `bill`                                    |
| `scc-cvig`          | Santa Clara County voter-guide PDFs                   | Candidate statements in `civic_api_cache` |
| `ca-sos-statements` | California candidate-statement pages and PDF fallback | Candidate statements in `civic_api_cache` |

`all` starts registered scrapers concurrently and validates the whole set's environment first. It is broader than a production scheduled refresh. The supervisor names jobs separately so it can control timing, retention, and budgets.

The `scotus` source reads the Court's current and previous October-term indexes,
combines entries for the same docket and publication date, and processes the
newest decisions first. It includes opinions relating to emergency orders,
such as the September 14, 2026 mail-ballot ruling in `26A305`. It does not cover
every unsigned order, circuit court, or district court decision. The complete
official PDF text remains separate from the generated explanation; when opinions
use separate PDFs, their URLs are retained alongside their text. Browse uses the
decision's publication date, stored in the shared `filedDate` field, rather than
the original lawsuit's filing date. No CourtListener token is needed.

To ingest only the latest published decision, after checking the selected database:

```bash
SCRAPER_MAX_NEW_ITEMS_PER_RUN=1 pnpm --filter @acme/scraper run start scotus --max-items 1 --concurrency 1
```

This command writes and may pay for one item's enrichment. The supervisor's
`scotus-daily` job scans 20 recent decisions with five generation slots per run.
Source/PDF failures and non-budget enrichment deferrals fail the job so the
supervisor retries with backoff. Reaching the generation budget is expected;
the next daily scan offers those decisions again.
Until that configuration is deployed, production does not run the new source.
Historical CourtListener rows are not rewritten by this change. Files under
[scrapers/disabled](src/scrapers/disabled/README.md) remain inactive.

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
