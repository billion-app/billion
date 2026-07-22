# NCSBE current-cycle election data

The `ncsbe` scraper discovers official public files from the NCSBE candidate-list
and election-results index pages. It does not hard-code election file URLs. At
runtime, discovery accepts only links for the current calendar-year election
cycle and prefers the structured candidate CSV and result ZIP/TSV files. The
official referendum PDF is used because NCSBE does not publish a structured
referendum download.

```bash
pnpm --filter @acme/scraper run start ncsbe --max-items 4
```

## Data boundaries

- Candidate addresses, phone numbers, and email addresses are discarded by the
  parser and have no database columns.
- Voter registration and voter-history products are never discovered or fetched.
- Historical links may be represented by small parser regression fixtures, but
  runtime discovery, persistence, and API reads reject non-current-cycle dates.
- Durham County is the primary validation jurisdiction. Wake County fixtures
  prevent county-specific assumptions.

## Storage and idempotency

`election_source` stores provider, source kind, exact URL, fetched time, SHA-256,
parser structure version, election date, and certification state. Provider-neutral
candidate, referendum, and result tables reference that row. A re-run upserts the
same source identity and replaces its child rows in one transaction, so interrupted
runs roll back and completed re-runs do not duplicate records.

The result ZIP's official media file is marked `official_not_certified`. NCSBE's
separate certified-result PDFs are intentionally not used when structured data is
available; a future certified structured file can use `certified` without changing
the reader contract.

## API reader and Civic matching

`civic.getNcElectionData` accepts `county`, an ISO `electionDate`, optional Google
Civic contest references, and optional `includePrecincts`. It returns candidate,
referendum, county-total result, and (when requested) precinct records. Every row
includes its exact source URL, checksum, fetched time, structure version, and
certification state.

Contest and candidate matching first compares normalized values exactly (case,
punctuation, `NC`/`North Carolina`, and primary-party suffixes are normalized).
The only fuzzy fallback is token Dice similarity of at least `0.82`, and it is
accepted only when the best result is at least `0.08` ahead of the runner-up.
Uncertain matches are omitted rather than guessed.
