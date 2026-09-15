# Ballot read limits

Issue #335 protects the existing `getVoterInfo` API path. The public response shape,
provider selection and cache freshness policy stay the same. No UI integration is
required. Lookup/status UI consumers should display the unavailable error without
interpreting it as an empty ballot or unpublished election.

## Cold reads and failure

Previously, every simultaneous cache miss fetched voter info, enriched all contests
and wrote the same cache entry. The candidate limiter limited running candidates,
but did not coalesce ballots or bound its waiting queue across requests.

[The voter-info entry point](../packages/api/src/lib/civic.ts) now shares the full
cache-read/provider/enrichment/cache-write operation for an identical hashed,
trimmed, case-insensitive address and election ID. Different elections remain
separate. The [read guard](../packages/api/src/lib/civic-read-guard.ts) admits at
most 32 distinct operations per process and has no waiting queue. Duplicate
callers share the admitted operation, including its deadline.

Each caller receives a result or failure within ten seconds of admission. Google
Civic requests have a four-second abort deadline, including response-body reads.
The existing unknown-election retry remains limited to one retry. Provider,
cache or enrichment failures may still fail the read; the router returns a generic
message so provider payloads do not expose addresses. Timeout and admission
failures use tRPC `SERVICE_UNAVAILABLE`.

A timed-out operation keeps its slot until the underlying work settles. Database
and enrichment work is not cancelled by the response deadline. If all slots hang,
this process fails closed until work settles or the process restarts. This is a
process-local bound, not a deployment-wide provider quota. Distinct ballots can
still repeat candidate enrichment, and unusually large provider ballots can still
create substantial enrichment work within a slot.

## Freshness and warming

Warming is demand-driven only: one admitted read can populate one existing ballot
cache entry. There is no scheduled warmer, new persistence, stale-on-error fallback
or automatic retry loop. Existing expiry remains 24 hours for voter info; expired
rows are never read as current logistics. Existing source fields and AI labels are
returned unchanged. The response does not yet expose cache timestamps; this change
does not claim that a cached location has been independently verified recently.

## Bounded verification

Run `pnpm --filter @acme/api test` from the repository root. The
[guard tests](../packages/api/src/lib/civic-read-guard.test.ts) exercise the exact
admission/deadline helper used by voter info with fake upstream work. No production
database or provider is contacted. Two bursts each contain 100 simultaneous
identical cold requests with a 20 ms fake provider. The local regression limits
are one upstream request per burst, p95 below 200 ms, zero errors on success and
100 explicit errors on provider failure. These are test limits, not agreed
production latency objectives. Additional checks cover admission exhaustion,
non-cancellable work, recovery, synchronous failure and election-key isolation.

These tests do not measure real provider latency, database pool contention,
enrichment cost, cross-process coalescing or the tRPC HTTP transport. Production
capacity limits still require an agreed traffic envelope and a separately
authorized staging exercise. No production mobile changes are included.

### Base-only lookup integration (#329)

`civic.getVoterInfo` accepts optional `includeEnrichment: false`. Omitting it
preserves enrichment. Base-only reads use the `voterinfoBase` endpoint in the
existing cache table; enriched reads retain `voterinfo`. In-flight keys also
include the mode. Both modes retain `otherElections?: Election[]` and use the
same expiry policy. The loader tests verify both cache modes, preservation of
other elections, and the one-retry ceiling without external services.

Local run on September 14, 2026: the 100-request successful burst recorded
p95 23.0 ms, 0% errors and one upstream call. The failing burst recorded p95
23.1 ms, 100% explicit errors and one upstream call. These fake-provider results
validate coalescing, not real-world availability or production capacity.
