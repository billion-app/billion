# Texas Current-Election Data

## Scope

`texas-current-election` ingests **only the current Texas election cycle** plus
the latest cycle-specific constitutional-amendment analysis. It does not expose
historical browsing, accept a year from API callers, or backfill older cycles.

The Texas Secretary of State (SOS) is authoritative for statewide election
facts: elections, contests, candidates, vote totals, county totals, turnout,
reporting progress, outcomes, and whether the results application labels an
election official. The Texas Legislative Council (TLC) supplies nonpartisan
explanatory text: ballot language, summary/background analysis, supporter and
opponent comments, and fiscal implications. These providers are persisted in
separate rows and receive separate field-level citations in the reader.

Texas SOS is **not a complete source for local Texas elections**. This pipeline
normalizes the statewide, federal, and district records the SOS publishes; it
does not imply that every city, school-district, county, or special-district
contest is present.

## Sources and discovery

- SOS results app: `https://goelect.txelections.civixapps.com/ivis-enr-ui/races`
- TLC publications: `https://tlc.texas.gov/publications`

The scraper reads the SOS application's `electionConstants` JSON to discover
the newest cycle and its election IDs. It never constructs a URL from a
hard-coded year. It also discovers the newest non-condensed `analysesNN.pdf`
link from the TLC publications HTML. When the TLC report belongs to the prior
calendar year (for example, the 2025 amendment election during the 2026 general
cycle), the scraper fetches only that matching SOS constitutional-amendment
election so the current TLC analysis can be paired with its SOS outcome.

The Civix API wraps sections as base64 JSON. Parsing is deterministic and
normalizes:

- candidate and proposition contests, parties, incumbency, votes, percentages,
  early votes, winners, and proposition outcomes;
- counties/precincts/polling places reporting and official/unofficial status;
- per-county choice totals and turnout;
- source version and SHA-256 content checksum.

TLC PDFs are read from their text layer page-by-page. There is no AI or vision
step in the normal path. Each extracted field links to `#page=N` in the official
PDF. Missing optional sections produce diagnostics and do not discard the rest
of the proposition.

## Persistence and reader

The provider-neutral `election_source_snapshot` table stores one idempotent row
per `(jurisdiction, cycle_year, provider, scope)`. Texas writes `texas-sos` and
`texas-tlc` rows with `scope = current`; certification/status refreshes update
those rows instead of creating duplicates.

Apply `packages/db/migrations/add_election_source_snapshots.sql` before the
first run, then execute:

```sh
pnpm --filter @acme/scraper run start texas-current-election
```

`TX_SOS_MAX_ITEMS` (default `12`) or the CLI `--max-items` flag caps source
records per run. `POSTGRES_URL` is the only required credential; both sources
are public and require no API key.

Consumers call the public tRPC query `civic.getTexasCurrentElection`. It has no
input by design. The response contains the newest SOS cycle and the latest TLC
amendment cycle. TLC propositions are matched to SOS outcomes by election cycle
and proposition number; each result retains its SOS citation while every
analysis field retains its TLC page citation.

The same persisted data is wired into `civic.getVoterInfo` through
`measure-sources/texas-official.ts`. A Google Civic measure is matched by exact
election date/year and proposition number, with title similarity only as a
fallback when the number is absent. Vote Smart matching also rejects records
whose published election date differs. The canonical measure exposes SOS
`result` facts and TLC summary/fiscal/pro-con fields with separate citations.

## Verification

Fixtures cover candidate results, county amendment totals, the 2025 TLC layout,
and the alternate 2023 layout. Tests assert current-cycle discovery, idempotent
identities, official status, turnout/outcomes, page citations, source separation,
and fail-soft behavior for a missing section.
