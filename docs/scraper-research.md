# Shared scraper research

A scraped bill already supplies its original text. Background research adds the
history, useful further reading, and attributed arguments with documented
examples. These used to run in separate model loops. The scraper now builds one
[source evidence collection](../apps/scraper/src/research/shared.ts) per title,
original-text revision, content type, and official source URL, and reuses it for
both the structured brief and competing perspectives. Status-only changes can
reuse research without treating an old legal status as current: the brief still
receives the current source actions and status separately.

## Discovery and reading

The official text already collected by the source adapter is added directly to
the research library. Up to two additional `.gov` or `.edu` URLs present in that
text are read directly before discovery. A known URL does not need a web search.
The model first searches previously retrieved documents. If those documents leave
a specific gap, it can explicitly request external discovery. The shared loop
allows eight model rounds and six search-tool calls; local searches also count
against that tool-call bound. Opening a page remains separate from finding it.

The [library](../apps/scraper/src/research/library.ts) caches discovery results by
normalized query and provider configuration for one day, and fetched documents
for seven days. Identical concurrent requests within a scraper process share
one operation. A new process reads the same PostgreSQL records. Empty discoveries,
failed page reads, and research without notes and at least two successfully read
sources are not persisted as successful research. The serial production
supervisor provides cross-job ordering; separate concurrent processes can still
duplicate a cache miss. The library is not a distributed work queue.

Collected notes expire with their earliest source document, up to seven days.
Citation IDs include only documents actually read, including the source adapter's
original text. Search snippets alone never become citation evidence. Original
source text and its URL, SHA-256 hash, and retrieval time live in
`research_document`; generated research notes live separately in `research_cache`.
A changed document creates a new retained source version rather than overwriting
the old body. PostgreSQL full-text search indexes the source title and body and
returns only fresh versions; it does not search generated claims.

The [page reader](../apps/scraper/src/research/pages.ts) extracts HTML, plain text,
and PDFs. It limits response sizes and times, removes page navigation, validates
public network addresses, pins those addresses to the actual connection, and
rechecks redirects. Discovery can use an explicitly configured private search
service; discovered source pages cannot reach private services.

Missing research remains an evidence gap. Bill briefs can use the official text,
and unsupported perspective points are dropped by the existing citation gate.
A cache hit proves reuse, not factual correctness or adequate coverage of every
argument. Retrieval dates make the freshness limits reviewable.

## Storage and rollout

Apply migration `0026_little_lizard.sql` through the
[committed migration workflow](data-layer.md#migrations) before running this
scraper build. It adds the source library and cache with RLS enabled and no public
policies. The trusted server database connection owns writes; Expo and browser
bundles receive neither these tables nor database credentials.

Existing valid briefs and lenses keep their cache versions, so this change does
not automatically regenerate the archive. New or stale assets use the shared
research path. The regular ingestion path, new-bill assembly, retroactive lens
job, and content repair command all pass the same official source URL.

The source library currently retains historical source versions. Track its size
alongside the database budget before a large backfill; a retention policy for
research snapshots is separate from bill retention. Do not run an unbounded
archive import to warm it. Commands for verification and the bounded search trial
live in the [scraper operations guide](../apps/scraper/README.md#search-research-verification).

## Provider choice

`SCRAPER_SEARCH_PROVIDER=searxng` sends discovery only to
`SCRAPER_SEARXNG_BASE_URL`. It serializes queries and leaves at least two seconds
between starts. It never falls back to Tavily or another paid provider. An empty
response with failed upstream engines is an error, not evidence that no sources
exist. `tavily` and `hosted` retain their explicit existing behavior.

SearXNG aggregates upstream engines; it does not provide an independent web index.
Its quality depends on which engines actually respond from the host. Compare
opened pages and their relevance before selecting it in production. The local
library can reduce discovery with any provider; it is useful even if a trial
shows SearXNG is unsuitable for a particular topic.
