# Election status and coverage

The mobile evidence labels describe what the source actually establishes. Candidate
`onBallot` and `withdrewStillOnBallot` values are labelled as provider reports,
not human verification or a guarantee of eligibility. Statement-guide membership
never establishes ballot status. Missing or unsupported statuses stay unknown.

[Shared labels](../apps/expo/src/components/ballot-evidence/election-status.ts)
are used by candidate details, race lists, ballot cards and the California preview.
Provider lookups remain partial; missing entries are not evidence that a race does
not exist. Existing lookup recovery suppresses mismatched election results.

[Source disclosures](../apps/expo/src/components/ballot-evidence/BallotEvidence.tsx)
keep retrieval and human verification separate, reusing the existing citation
metadata. An optional absolute `staleAfter` deadline and `conflicting` flag enable
warnings and an election-office next step. No default freshness budget is inferred.
These fields are a presentation contract; existing provider adapters do not yet
supply them. A verified-complete label is available only for a future caller with
complete official-record evidence; no current screen uses it.

## Remaining release gates

Issue #425 remains open until production mobile evidence and real-reader
comprehension checks cover complete verified ballots, partial/non-California
results, guide-only inclusion, failure, mismatch, stale and conflicting sources.
Issue #418 owns provider enablement and status provenance. Issues #419/#422 own
date-scoped voting guidance; this change does not infer election stages from a
calendar or overwrite their dates. Issue #299 still needs agreed field freshness
budgets and human-review evidence. No database or provider writes are required by
this presentation change.
