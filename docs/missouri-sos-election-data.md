# Missouri SOS current-cycle election data

`missouri-sos` ingests only the 2026 Missouri election cycle from the four
official Secretary of State entry points named in issue #186. It does not offer
historical browsing and never requests or persists voter-level data.

```bash
pnpm --filter @acme/scraper run start missouri-sos
```

## Discovery and source boundaries

- The [2026 election calendar](https://www.sos.mo.gov/elections/calendar/2026cal)
  determines the active statewide primary or general election and its final
  certification date. No archival result URL is constructed.
- The [certified candidate system](https://s1.sos.mo.gov/candidatesonweb/)
  supplies the current election code. The scraper follows its cumulative
  certified-list and withdrawn/removed-list links, which avoids crawling every
  office page. Only office, district, party, candidate name, ballot order, and
  withdrawal status are parsed. Address, filing-contact, and other location
  cells are deliberately ignored.
- The [2026 certified ballot-measure page](https://www.sos.mo.gov/petitions/2026BallotMeasures)
  supplies the election date, official title/language, fair ballot language,
  fiscal statement, and links to the full text and signed certificate. Only
  sections explicitly labeled certified on that page are accepted.
- The [ShowMO Votes entry point](https://www.sos.mo.gov/elections/showmovotes)
  is searched for a link matching the active 2026 election. Before publication,
  the snapshot is still stored with an explicit `availability: "unavailable"`
  diagnostic. A historical-looking results fixture exists only to lock the
  table parser; no historical URL appears in production code.

All network calls use the shared retry/backoff client and shared runner
concurrency. The candidate system is read through its single cumulative page,
keeping request volume low. `MISSOURI_SOS_MAX_ITEMS` defaults to `1000` and may
be lowered for development runs; a truncation diagnostic is persisted whenever
the cap is reached.

## Persistence and API

Missouri reuses PR #181's provider-neutral `election_source_snapshot` table:

- jurisdiction: `MO`
- cycle: `2026`
- provider: `mo-sos`
- scope: `current-2026`

The normalized snapshot is SHA-256 hashed without fetch timestamps. Its natural
key is upserted, so unchanged runs remain one row while official corrections or
result updates replace the payload and checksum. Each record carries an
official-source citation, and the reader validates the JSON contract before
returning it.

Consumers call the input-free public tRPC query
`civic.getMissouriCurrentElection`. The API has no year, election ID, or history
parameter, so it cannot expose a historical cycle accidentally.
