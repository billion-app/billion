# Ballot reads

`civic.getVoterInfo` reads an address-scoped ballot through
[Democracy Works REST v2](https://developers.democracy.works/api/v2).
`includeEnrichment: false` skips supplementary enrichment; omission includes it.
`civic.getElections({ address })` lists address-scoped alternatives. Without an
address it returns an empty list. The provider adapter is in
[democracy-works.ts](../packages/api/src/clients/democracy-works.ts).

## Provider access

Configure the server-only `DEMOCRACY_WORKS_API_KEY` with access to REST v2
`/elections`, including `includeBallotData=true`. Obtain a test key or account
through the provider's access process, then run `pnpm env:doctor --target nextjs`
from the repository root. The key belongs in the API runtime, never Expo. Missing
access fails closed; ballot reads have no Google fallback or mock-data mode.

Democracy Works sources ballot data from Ballotpedia. Its documented ballot scope
includes federal/state contests and limited local coverage. Its product and
[research process](https://www.democracy.works/research) describe Google Civic as
an upstream tool. Billion's ballot transport calls Democracy Works directly;
Google independence of the provider's supply chain is unverified.

## Identity and response meaning

Democracy Works election records have no provider ID. The adapter constructs
`dw:YYYY-MM-DD:sha256` IDs from jurisdiction OCD-ID, date, type, description and
canonical source URL. It sorts by date and ID, rejects duplicate identities and
matches explicit selections exactly. Old Google IDs and missing selections fail
without selecting another election. Alternatives remain in `otherElections`.

`provider.coverage` is `partial`. `provider.addressScope` distinguishes
`address`, `statewide_only` (the provider could not map below the state level),
and `unknown` (the mapping flag was absent). `provider.ballotDataStatus` reports
whether ballot fields were supplied; it does not certify completeness or official
publication. Candidate rows require an explicit `onBallot` or
`withdrewStillOnBallot` status. The latter is exposed as `ballotStatus` for callers
to label. Cancelled contests are omitted. Unknown or absent candidate status is
insufficient to include that candidate.

`submittedAddress` is the user's input. The provider's elections endpoint supplies
no normalized address, so the required legacy `normalizedInput` fields are empty
strings and `provider.addressNormalization` is `unavailable`. Consumers must not
present that object as a verified address or derive state from freeform input.
Election jurisdiction remains available as `election.ocdDivisionId`.

`provider.sourceUrl`, `updatedAt` and `fetchedAt` carry provider attribution and
retrieval metadata, not independent verification. Ballot fields cite Democracy
Works/Ballotpedia with `official: false`. Lookup URLs are passed through in the
legacy administration-body fields; their placement does not establish that the
provider or URL is an election authority. Use neutral labels unless the destination
has been verified separately.

The adapter returns lookup links rather than assigned voting locations. The
separate `/voting-locations` API has its own election identity and no documented
selection filter; its locations are not joined to the selected ballot. Registration,
mailing and voting deadlines are not inferred from guidance phases or missing data.

## Cache and request bounds

Cache endpoints begin with `democracy-works:v2:1`, followed by `elections`, `base`
or `enriched`. Address hashes and election parameters also distinguish entries.
Old Google cache entries are excluded. Entries expire after 24 hours; expired data
is not returned on failure. Discovery cache keys include the query date.

The [read guard](../packages/api/src/lib/civic-read-guard.ts) shares identical
operations and admits up to 32 distinct operations per process without a queue.
Base reads and discovery have a 10-second response deadline; enriched reads have
60 seconds. Each provider request has a four-second abort deadline through body
reading. Pagination is capped at two pages of 100 records. Overflow, inconsistent
pagination and malformed payloads fail instead of returning a truncated ballot.

A response timeout does not cancel database or enrichment work. Its slot stays
occupied until that work settles, preventing retries from accumulating more work.
Hung work can exhaust the process's slots. These limits are per process; large
ballots and separate processes can still produce substantial upstream work.

## Verification

Run `pnpm --filter @acme/api test` and `pnpm --filter @acme/env test` from the
repository root. The [adapter tests](../packages/api/src/clients/democracy-works.test.ts)
use synthetic responses to exercise mapping, candidate status, selection identity,
missing access, schema errors, pagination and header/body timeouts. The
[loader tests](../packages/api/src/lib/civic-voter-info.test.ts) verify provider
cache isolation and failure behavior. The
[guard tests](../packages/api/src/lib/civic-read-guard.test.ts) print latency,
errors and upstream counts for bounded fake-provider bursts.

The public OpenAPI schema declares single contest/measure objects, while collection
shapes are plausible. The parser accepts either an object or an array and rejects
malformed values. The documentation's election examples omit ballot fields.
Synthetic tests verify the adapter's handling, not the licensed live response
shape, endpoint entitlement, jurisdiction coverage or production capacity.
Live acceptance requires an authorized key and comparison with official sample
ballots for the intended release jurisdictions.
