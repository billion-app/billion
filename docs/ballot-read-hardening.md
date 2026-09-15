# Ballot read limits

`civic.getVoterInfo` reads a ballot for an address and optional election ID.
It includes enrichment by default; `includeEnrichment: false` requests provider
data without enrichment. Both modes return the provider's `election` and optional
`otherElections`.

## Request sharing and deadlines

[The voter-info entry point](../packages/api/src/lib/civic.ts) shares one operation
among concurrent callers with the same trimmed, case-insensitive address,
election ID and enrichment mode. The address is hashed in the key. The shared
operation covers the cache read, provider request, enrichment and cache write.
Duplicate callers share its deadline.

The [read guard](../packages/api/src/lib/civic-read-guard.ts) admits up to 32
distinct operations per process. Additional distinct requests fail immediately;
there is no waiting queue.

| Operation            | Deadline                                   |
| -------------------- | ------------------------------------------ |
| Base-only ballot     | 10 seconds from admission                  |
| Enriched ballot      | 60 seconds from admission                  |
| Google Civic request | 4 seconds, including reading the response  |

The 60-second enrichment deadline is provisional. Enrichment source fetches can
allow 12 seconds each, candidate work has a concurrency limit of five, and AI
calls lack an explicit deadline. Slow enrichment can outlast the response deadline.

A timed-out operation occupies its slot until the underlying work settles.
The response deadline does not cancel database or enrichment work. If all 32
slots hang, the process rejects reads until work settles or the process restarts.
The limit applies independently in each server process. Distinct ballots can
repeat candidate enrichment, and large ballots can create substantial work
within one slot.

## Cache identity and freshness

The [loader](../packages/api/src/lib/civic-voter-info.ts) uses separate endpoints
in `civic_api_cache` for each mode:

| Request mode                     | Cache endpoint |
| -------------------------------- | -------------- |
| `includeEnrichment: false`       | `voterinfoBase` |
| `includeEnrichment: true` or omitted | `voterinfo` |

Cache keys also include the normalized address hash and election ID, when
specified. Entries expire 24 hours after the cache write. Reads exclude expired
entries, including during provider failures. Cache population is demand-driven:
a successful cache miss writes one entry. The response does not expose
cache timestamps, so consumers cannot determine a cached location's age from
the response.

## Election fallback and errors

If Google Civic rejects an explicit election ID with "Election unknown", the
loader retries once without that ID. The response contains the returned
`election.id`, and the cache write uses that returned ID. Consumers must compare
requested and returned IDs before labeling a ballot as the selected election.

Provider, cache or enrichment failures can fail the read. The
[civic router](../packages/api/src/router/civic.ts) returns a generic unavailable
message rather than provider error details. Timeout and admission failures use
tRPC `SERVICE_UNAVAILABLE`; other read failures use `INTERNAL_SERVER_ERROR`.
Consumers should display an unavailable state rather than interpreting a failure
as an empty ballot or evidence that an election is unpublished.

## Verification

Run `pnpm --filter @acme/api test` from the repository root.

The [guard tests](../packages/api/src/lib/civic-read-guard.test.ts) use fake
upstream work. Each cold-cache burst has 100 simultaneous identical requests
and a 20 ms fake provider. The tests print request counts, upstream counts, error
counts and p95 latency, with these regression limits:

- One upstream request per burst.
- p95 latency below 200 ms.
- Zero errors for success; 100 explicit errors for provider failure.

The guard tests also cover admission exhaustion, timeout slot retention,
recovery, synchronous failures, key isolation and separate response deadlines.
The [loader tests](../packages/api/src/lib/civic-voter-info.test.ts) use an
in-memory cache to verify separate base/enriched entries, `otherElections`, the
one-retry limit and fallback election identity.

These tests run without live providers or a database. They cover the guard and
loader, but do not measure HTTP transport, database contention, actual enrichment
cost or production capacity. Production latency and capacity limits require a
traffic model and staging measurements.
