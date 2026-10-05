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
| `santa-cruz-locations`  | Election-specific Santa Cruz vote-center lists              | County locations in `civic_api_cache`          |
| `ca-official-guide`     | Date-scoped California official measure and candidate guide | Official guide records in `civic_api_cache`    |
| `ca-election-logistics` | California SOS election-specific key dates                  | Statewide voting guidance in `civic_api_cache` |
| `ca-sos-statements`     | California candidate-statement pages and PDF fallback       | Candidate statements in `civic_api_cache`      |
| `scotus`                | Supreme Court opinion and order-opinion indexes/PDFs        | `court_case`                                   |
| `ecourt-records`        | Publicly indexed Massachusetts criminal docket snapshots    | `court_case`                                   |

`all` starts registered scrapers concurrently and validates the whole set's environment first. It is broader than a production scheduled refresh. The supervisor names jobs separately so it can control timing, retention, and budgets.

`ecourt-records` discovers criminal cases from the independent [eCourt Records archive](https://ecourtrecords.org/), then refreshes the indexed case pages. The current index includes Orleans District Court case `2626CR000731` (Commonwealth v. Peters). It preserves charges as allegations, docket text, scheduled events, the source URL, and the date of the latest docket entry. The supervisor checks up to five indexed criminal cases daily with two generation slots. New cases are selected before stored ones; stored cases rotate by their last source refresh. Failed cases enter the shared retry queue with backoff, allowing healthy cases to keep advancing while failures remain visible. Run a bounded manual refresh with `pnpm --filter @acme/scraper run start ecourt-records --max-items 1 --concurrency 1` after checking the selected database. The archive says its snapshots may omit later activity, so a successful job only confirms what the archive currently publishes; check the court for an authoritative status. The official MassCourts case portal disallows crawling in its robots policy and is not scraped.

The `scotus` source reads the Court's current and previous October-term indexes,
combines entries for the same docket and publication date, and processes the
newest decisions first. It includes opinions relating to emergency orders,
such as the September 14, 2026 mail-ballot ruling in `26A305`. It does not cover
every unsigned order, circuit court, or district court decision. The complete
official PDF text remains separate from the generated explanation; when opinions
use separate PDFs, their URLs are retained alongside their text. Browse uses the
decision's publication date, stored in the shared `filedDate` field, rather than
the original lawsuit's filing date. No CourtListener token is needed.

To scan the latest published decision with one generation slot, after checking the selected database:

```bash
SCRAPER_MAX_NEW_ITEMS_PER_RUN=1 pnpm --filter @acme/scraper run start scotus --max-items 1 --concurrency 1
```

This command writes and may pay for one item's enrichment. Each run also selects
up to `max-items` due retries, sharing the same generation budget. The supervisor's
`scotus-daily` job scans 20 recent decisions plus up to 20 due retries with five
generation slots per run. Deferred cases and PDF failures are stored in
`scraper_retry`, keyed by term and docket, and remain eligible outside the recent
window. Queued terms are fetched even after they age out of the two-term scan.
Healthy cases are processed despite failures in other PDFs; outstanding failures
then fail the job so the supervisor retries with backoff. Budget deferral alone
is expected and does not fail the job.
Until that configuration is deployed, production does not run the new source.
When a refreshed docket already exists under the old CourtListener court-URL
alias, its source fields and court name are updated on the original ID rather
than creating a second card. Changed court text invalidates its old generated
summary, article, and perspectives, and makes a cached court brief stale, so a budget-limited refresh cannot permanently reuse an
explanation of the previous decision. Other historical records are not bulk rewritten. Files under
[scrapers/disabled](src/scrapers/disabled/README.md) remain inactive.

Each source declares its environment contract in an adjacent `*.config.ts`. Use those contracts and [the environment guide](../../docs/launch.md#scraper-and-scheduled-data-jobs) for required provider keys and current defaults.

### Court brief rollout and verification

New SCOTUS enrichment generates a validated court brief and reuses its takeaway
for the card summary. It does not generate a redundant Markdown explanation.
The normal run's generation slots cover missing, stale, and invalid briefs too.
Legacy Markdown records remain readable until refreshed. Source text, URLs,
separate opinion documents, and case UUIDs remain intact.

Historical generation is opt-in. First inspect the database host with the
environment doctor. Inventory is read-only unless `--apply` is supplied:

```bash
pnpm --filter @acme/scraper run reprocess-content --type court_case --limit 1
pnpm --filter @acme/scraper run reprocess-content --type court_case --id UUID --limit 1 --concurrency 1 --apply
```

Court writes require an explicit positive limit, including `--type all`. This is
an item cap, not a dollar quota; each selected item may also generate optional
lenses or artwork. Production writes additionally require the tool's `--yes`
acknowledgement. Verify the active provider and credit before opting into paid
generation. The deterministic tests below do not prove paid provider availability.

Use a migrated local fixture database for the complete deterministic chain.
Both database tests refuse remote hosts and remove only their own UUIDs. The
new test uses the real generator with an AI SDK test model, exercises ordinary
upsert/cache behavior and real tRPC detail, and writes optional response artifacts.
It lives in `packages/api/test` so the scraper build does not import the API's
auth context. All fixture reads and writes use the shared Drizzle schema.
The Expo test renders the actual court component through React Native Web:

```bash
mkdir -p /tmp/billion-court-brief-check
SCOTUS_TEST_POSTGRES_URL=postgresql://LOCAL_USER@127.0.0.1:5432/LOCAL_FIXTURE_DB pnpm --filter @acme/scraper exec tsx --test src/scrapers/scotus-db.test.ts
SCOTUS_TEST_POSTGRES_URL=postgresql://LOCAL_USER@127.0.0.1:5432/LOCAL_FIXTURE_DB COURT_BRIEF_TEST_ARTIFACT_DIR=/tmp/billion-court-brief-check pnpm --filter @acme/api exec tsx --test test/court-brief-db.test.ts
COURT_BRIEF_TEST_ARTIFACT_DIR=/tmp/billion-court-brief-check pnpm --filter @acme/expo exec tsx --test src/components/ui/CourtBrief.test.ts
pnpm --filter @acme/scraper exec tsx --test src/utils/ai/court-brief.test.ts
```

These cover `26A305` with full official PDF text, synthetic merits and separate
concurrence/dissent documents, sparse evidence, invalid citations/quotes,
source/version invalidation, missing briefs, cache reuse without budget, and
retry behavior. `court-brief.html` is the rendered artifact; the JSON files are
actual tRPC results for valid, missing, invalid, and stale cases.

To check the full article route in a browser, start Expo with fixture transport
instead of a live API, then run the script in another terminal. It delivers the
real response artifacts above through local tRPC transport and checks all four
states plus the original-text tab. It saves a screenshot and closes its browser:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:4013 pnpm --filter @acme/expo exec expo start --web --port 8091
COURT_BRIEF_TEST_ARTIFACT_DIR=/tmp/billion-court-brief-check node scripts/verify-court-brief-web.mjs
```

The browser script uses `pnpm dlx agent-browser` and binds its fixture server to
`127.0.0.1:4013`. Stop Expo when finished. The database fixture refuses to replace
an existing `26A305` record, so use an empty local fixture database.

The court identity/source-refresh database regression is opt-in. Set
`SCOTUS_TEST_POSTGRES_URL` to a migrated local database, then run:

```bash
pnpm --filter @acme/scraper exec tsx --test src/scrapers/scotus-db.test.ts
```

It refuses remote hosts, uses zero generation slots, verifies stored source
fields and stale-content invalidation through typed Drizzle queries, and removes
only its own fixture UUID afterward.

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
| `notify-followers`           | Enqueue and send lock-screen alerts for followed bills            |
| `prune-bills`                | Inspect retention candidates; read-only until `--apply`           |

`content-images` accepts `--type bill`, `--type government_content`, or
`--type court_case` for a bounded single-domain run. Production's manual
`court-image-smoke` supervisor job uses `--type court_case --other-limit 1`
with suitability review enabled; it is a real generation check, not a fixture.

For example:

```bash
pnpm --filter @acme/scraper retroactive-lenses --type bill --limit 1 --dry-run
```

Use `reprocess-content --assets briefs` with `--type bill` or
`--type court_case` to repair structured briefs without also regenerating
perspectives or feed imagery. Production writes still require `--apply --yes`
and an explicit limit for court cases.

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
California Secretary of State guide. It preserves official summaries, Yes/No
vote meanings, fiscal impacts, published pro/con summaries, candidate statements,
office-duty bullets and proposed-law PDF links. Set `CA_GUIDE_ELECTION_DATE` to the exact election date. Every source page
must carry that date in its election banner. An incomplete bounded sample cannot
replace the stored collection. Candidate columns are parsed for both partisan
and nonpartisan offices. An explicit “No candidate statement” notice is valid;
missing or unrecognized candidate markup aborts the refresh so it cannot erase
stored statements.

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

`santa-cruz-locations` discovers the vote-center list linked from a configured
Santa Cruz election page. It validates the visible election date, URL, and
opening schedules before storing addresses, published hours, and local
exceptions. The API attaches these countywide centers only when Democracy Works
returns an address-matched ballot with one consistent Santa Cruz county division.
Undated drop-box records are excluded.

Configure `SANTA_CRUZ_ELECTION_DATE` and `SANTA_CRUZ_ELECTION_PAGE_URL`; the daily
job selects the November 3, 2026 general election. `SANTA_CRUZ_LOCATIONS_MAX_ITEMS`
and `--max-items` accept one election collection per run. Missing published lists
or inconsistent source dates fail without replacing stored records.

```bash
pnpm --filter @acme/scraper exec tsx src/scrapers/santa-cruz-locations-preview.ts 'https://votescount.santacruzcountyca.gov/Home/Elections/November3,2026CaliforniaGeneralElection.aspx' 2026-11-03
pnpm --filter @acme/scraper start santa-cruz-locations --max-items 1
```

Coverage is California statewide guide content and statewide voting guidance,
plus published Santa Cruz vote centers. Santa Clara locations and other states
remain outside these collectors. The Santa Clara CVIG scraper has only 2024
PDF discovery configured. Its year-scoped cache and the separate
`ca-sos-statements` cache are not used by this date-scoped ballot path.

### Proposition review dry-run

Consequence analysis is gated by [the reviewed revision contract](../../docs/proposition-consequences.md). Capture an official guide payload using the existing bounded guide collector; do not run ingestion against an unchecked database target. The following review commands only read local files and select one proposition:

```bash
pnpm --filter @acme/api exec tsx src/tools/review-proposition.ts /absolute/path/guide.json 5
pnpm --filter @acme/api exec tsx src/tools/review-proposition.ts /absolute/path/guide.json 5 /absolute/path/revision.json
```

The first prints the source snapshot and hash for review. The second prints the candidate revision and whether the publication gate accepts it, exiting nonzero if blocked. It never calls a model, approves a revision, or writes data. Do not put credentials in captured payloads. An editor must review claim support and uncertainty under #334 before an approved revision is committed; see the remaining pipeline gates in the contract above.

### Cross-measure discovery and drafting

`measure-relationships` examines an election's measures together. It discovers
all measure pages from the official index, captures each measure's complete
legal PDF and official analysis once, then evaluates every unordered pair. It
requires no authored relationship or selected proposition numbers. California
is the current source adapter; the discovery and reader copy are not specific
to an election or tax issue. Multiple relationships can attach to one measure.

These commands write local files, not the database. Collection needs `pdftotext`
on PATH and caps each source download at 5 MB. An election exceeding the explicit
measure or pair budget fails instead of silently sampling. Run from the repo root:

```bash
pnpm --filter @acme/scraper measure-relationships collect 2028-11-07 /tmp/measure-corpus.json --max-measures 20
pnpm --filter @acme/scraper measure-relationships generate /tmp/measure-corpus.json /tmp/relationship-drafts.json --max-pairs 190 --max-model-calls 190 --max-prompt-chars 200000
```

The date must match the official site's current election. The example budgets
allow all pairs for up to 20 measures; choose explicit smaller limits for a
bounded run. Collection refuses to overwrite its output. **Generate calls the
configured scraper structured-output model and can spend money.** It uses one
selected provider, no automatic retries or provider fallback, an output-token
cap and a per-call timeout. All budgets are checked before model calls. Complete
evidence exceeding the prompt budget fails; it is never silently truncated.

The generic prompt distinguishes material operational relationships from shared
topics and generic conflict boilerplate. An unrelated pair returns no draft;
a one-measure election makes no model calls. Related drafts require valid claim
citations and exact legal-text quotations from both measures with section/page
locators. Models can still misinterpret law, so quotation validation is grounding,
not editorial approval. Passage scenarios are hypothetical; Yes-total comparisons
are optional and generated only where supported. Pair explanations do not claim
to model simultaneous three-way or larger legal interactions exhaustively.

The output records both related and unrelated assessments. Each completed pair
is saved atomically, with an input hash bound to full evidence, prompt version
and actual model. Rerun with the same output path to resume after interruption;
unchanged positive and negative assessments are reused without model calls.
Changed evidence or prompts require fresh assessments. `complete: false` marks
an interrupted run. Source capture and generated prose remain separate.

Every generated revision is **pending**. Inspect its causal warrants, each claim,
all four cases and uncertainties against the captured documents under #334 before
approval. Extract reviewed drafts into an array and explicitly record reviewer,
review time, findings, revision and the full evidence hash. The hash command does
not approve anything:

```bash
pnpm --filter @acme/scraper measure-relationships review-hash /tmp/one-reviewed-draft.json
pnpm --filter @acme/scraper measure-relationships register /tmp/measure-corpus.json /tmp/approved-relationships.json
```

`register` refuses pending, unsupported, stale or changed revisions. It writes
immutable revision files and regenerates the server registry from those files;
new pairs need no hand-written imports, API switches or renderer edits. Commit
these local artifacts through review. Normal guide ingestion refreshes the
registered approved source hashes (at most 200 distinct documents) without
regenerating explanations. Publication still requires matching guide identities,
source documents and whole-revision approval. The reader omits Related measures
when no relevant approved relationship exists, including missing/stale evidence.

The older two-measure `measure-relationship-preview.ts` remains a read-only
recapture tool for an existing authored draft; it is not the discovery workflow.
The [source-captured pilot](../../docs/evidence/447/README.md) is still pending.
