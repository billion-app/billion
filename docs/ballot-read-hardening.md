# Ballot reads

[`civic.getVoterInfo`](../packages/api/src/router/civic.ts) reads a ballot for an
address and optional election ID. It includes enrichment by default;
`includeEnrichment: false` returns provider data without enrichment. Both modes
return the provider's `election` and optional `otherElections`.

## Concurrent requests and timeouts

The [read guard](../packages/api/src/lib/civic-read-guard.ts) shares work for
concurrent requests with the same normalized address hash, election ID and
mode. One operation includes the cache read, provider request, enrichment and
cache write. It admits up to 32 distinct operations per server process;
additional distinct requests fail immediately without queuing.

Base-only reads have a 10-second response deadline; enriched reads have 60
seconds. Duplicate callers share the original deadline. Each Google Civic
request has a four-second abort deadline, including the response-body read.

A response timeout does not cancel database or enrichment work. The operation
holds its slot until that work settles. If every slot hangs, the process rejects
reads until work settles or the process restarts. These limits apply per process;
different ballots can still repeat candidate enrichment. The 60-second deadline
is provisional: candidate enrichment runs five at a time, source fetches can take
12 seconds, and AI calls have no explicit deadline.

## Caching and election identity

The [loader](../packages/api/src/lib/civic-voter-info.ts) stores base-only reads
under `voterinfoBase` and enriched reads under `voterinfo` in `civic_api_cache`.
Keys include the normalized address hash and requested election ID, when present.
A successful cache miss writes an entry that expires after 24 hours. Reads never
serve expired entries. The response has no cache timestamp.

When Google Civic rejects an explicit ID with "Election unknown", the loader
retries once without it. The response and cache write use the returned election
ID. Callers must compare requested and returned IDs before identifying a ballot
as the selected election.

## Errors and verification

Timeout and admission failures return tRPC `SERVICE_UNAVAILABLE`; provider,
cache and enrichment failures return `INTERNAL_SERVER_ERROR`. Both use a generic
unavailable message to keep provider error details private. A failed read is not
an empty ballot or evidence that an election is unpublished.

Run `pnpm --filter @acme/api test` from the repository root. The
[guard tests](../packages/api/src/lib/civic-read-guard.test.ts) check concurrent
request sharing, capacity, deadlines and recovery. The
[loader tests](../packages/api/src/lib/civic-voter-info.test.ts) check cache modes,
election alternatives and fallback identity with fake providers and an in-memory
cache. These tests do not measure live coverage or production capacity.
