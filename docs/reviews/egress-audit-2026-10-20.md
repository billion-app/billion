# Supabase egress audit — October 20, 2026

This is an audit of checkout `2002ecd0`, with read-only production measurements taken around 4:54–4:56 p.m. Pacific. The recommendations below are proposed work; no application code, deployment, or database data was changed.

The strongest finding is the translation worker's repeated archive sweep. Production logs show it repeatedly loading readers whose translations are already ready. Card overfetching and unbounded Featured selection are additional confirmed sources of unnecessary database traffic.

## Measurement scope

The supplied notice reports 7.42 GB against a 5.5 GB quota. The connected Supabase account did not expose Billion, so this audit used the repository's remote database connection explicitly, with `default_transaction_read_only=on` and statement timeouts. Root `.env.local` points to local Postgres; the measured remote target was project `gltwmqkdminbyqzmfich`, through `aws-1-us-east-1.pooler.supabase.com`.

Only aggregates, normalized query statistics, storage metadata, and translation-worker log summaries were retrieved. No source corpus or image files were downloaded. The [aggregate evidence](assets/egress-audit-2026-10-20.json) records the database snapshot and three activity samples.

Supabase counts data returned through the shared pooler as egress, even when the application discards it before responding to a phone. Cached Storage egress is accounted separately. See [Supabase's egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

Row sizes below use server-side `octet_length(row_to_json(row)::text)` and JSON/text payload lengths. They are comparable serialized-payload estimates, not measured PostgreSQL protocol bytes or the billing meter. MB and GB are decimal. Cumulative query statistics reset on June 29, 2026, so their totals must not be attributed to this billing cycle. Exact attribution of the notice still requires the organization's service-level usage breakdown.

## 1. High priority: stop continuously rereading translated readers

[The watch loop](../../apps/scraper/src/content-translations.ts) prepares ten readers per iteration, sleeps five seconds when the generation queue is idle, and starts over sixty seconds after completing the archive. [Reader preparation](../../packages/api/src/lib/pretranslate-readers.ts) loads each complete reader before checking translation readiness. That loads the source record, brief, lens, and then the cached translation payload. `translationOnly` skips artwork and sponsor lookup, but still selects every column of the source record.

Production evidence:

- The last 250 preparation log entries scanned **2,488 readers: all 2,488 ready, zero queued, zero failed**, including two completed sweeps.
- Across three snapshots spanning 60.208 seconds, archive-page queries returned another **70 IDs**, single-reader translation queries returned **65 cached rows**, and the full bill-by-ID query returned **56 bill rows**. The two roughly thirty-second intervals returned 30 and 40 archive IDs respectively; some work straddles sample boundaries.
- The database contains **1,164 source records**: 914 bills, 194 government records, and 56 court cases. All have stored Chinese translation rows; logs independently show the observed pages passing readiness checks.

| Data loaded during a complete sweep | Approximate serialized size |
| ----------------------------------- | --------------------------: |
| Full source records                 |                    47.12 MB |
| Brief JSON                          |                     6.98 MB |
| Lens JSON                           |                     7.24 MB |
| Chinese reader translation payloads |                     9.45 MB |
| Total                               |                **70.79 MB** |

This estimate excludes protocol overhead and small metadata queries. It is a current-corpus estimate, not a historical bandwidth measurement. At that size, about 78 passes represent 5.5 GB of serialized payload. The live one-minute sample confirms ongoing work, but is too short to establish a daily billing rate.

**Proposed fix:** retain the interactive translation queue, but replace the continuous full-content reconciliation with cheap revision checks and a bounded, infrequent repair sweep. Ingestion already calls `prepareReaderTranslation` after writes. Cover independent brief/lens refreshes and prompt-version changes too; a bill's source hash alone does not capture every change to a reader. Check cached revision/readiness metadata before loading prose, and avoid downloading a translated payload when the caller only needs a readiness result. An immediate mitigation can lengthen or disable only the archive preparation loop while keeping queue processing alive.

## 2. High priority: select card columns for lists and search

[Content routes](../../packages/api/src/router/content.ts) use unrestricted `.select()` for typed Browse at lines 537, 564, and 595; typed search at 665, 685, and 707; and `getAll` at 245–256. They convert the records into small cards afterward. Bills include full text and generated search vectors that cards never use. The mixed `all` queries already project fields explicitly, and `BILL_CARD_COLUMNS` already exists.

| Bill sample                 | Full rows | Existing card projection | Reduction |
| --------------------------- | --------: | -----------------------: | --------: |
| All 914 stored bills        |  38.77 MB |                  3.50 MB | **91.0%** |
| 21 most recent federal rows | 210.28 KB |                 26.80 KB | **87.3%** |

The recent-row sample isolates column selection; it does not reproduce the route's enacted-bill exclusion. These are database-result reductions, not whole-request savings. Image and translation lookups remain additional work.

**Proposed fix:** reuse the bill card projection and define narrow government/court projections. Preserve action fields currently needed for status. Give detail queries their own projection too: detail needs source text, but not `search_vector` or `versions`. Search can filter/rank on the search vector without returning it. Avoid fetching source text for translation preparation by projecting the authored prose and its source/fallback distinction directly.

## 3. Medium priority: rank Featured before returning candidates

[Featured selection](../../packages/api/src/router/content.ts) downloads every eligible scored bill with its card fields and action history, sorts in JavaScript, and only then slices to six. There is no SQL limit on the scored candidate query. The discovery-filtered federal/state variants have historical averages of **338.6 and 142.9 returned rows per call**, respectively.

**Proposed fix:** express eligibility, weighted score, ordering, editorial exclusion, and the remaining slot limit in SQL, then fetch cards for winners. Preserve editorial ordering, inactive override suppression, and deterministic tie breaking. Cache the public result briefly by jurisdiction and language, with invalidation or bounded staleness for editorial changes. Adding an arbitrary limit before ranking would change the winners.

## 4. Medium priority: poll translation status instead of entire feeds

[Card polling](../../apps/expo/src/utils/card-translation.ts) refetches every three seconds whenever any card is pending, with no elapsed-time cutoff. Home and Browse attach that policy to Featured, list, search, and infinite-list queries. If translation processing is unavailable or backed off, the full content query continues to execute while the observer remains active. Featured candidate downloads and typed-list overfetch are repeated along with translation checks.

**Proposed fix:** poll a small batch status endpoint keyed by content ID, language, and source revision, then refresh affected cards when ready. Add backoff and a wait limit analogous to the reader's existing translation wait handling. Set explicit freshness for public content queries; Expo's shared query client currently sets none. English cards are marked original and do not trigger this poll, so this is a conditional amplifier rather than a universal background timer.

## 5. Medium priority: create separate card image variants

[Image generation](../../apps/scraper/src/content-images.ts) converts artwork to JPEG at quality 84 without resizing. [Public URL construction](../../packages/db/src/content-images.ts) supplies the same original asset to cards and readers. Stored image metadata includes 955 images at 1024×768 and 580 at 1774×887. Across the bucket's 2,215 objects, the average object is **167,849 bytes**, with a maximum of **421,344 bytes**. Those include historical objects, so this is not a traffic-weighted average of active card images.

**Proposed fix:** generate content-addressed card and reader variants at upload, choose a card size suitable for display density, and retain originals where needed. Measure transfer and visual quality before selecting a format/quality target. Hash-based URLs and year-long cache headers already exist; preserve them. Actual savings require Storage request/cache-hit data.

## Smaller opportunities and exclusions

- [Source upserts](../../apps/scraper/src/utils/db/operations.ts) return complete rows at lines 501, 525, and 558, although downstream processing needs only `id` and `thumbnailUrl`. Return those columns explicitly. The regular bill/court/image assessment candidate queries are already selective and bounded; do not confuse their database scan work with returned-byte egress.
- [Upload verification](../../apps/scraper/src/utils/storage/content-images.ts) downloads each uploaded image to checksum it. This is deliberate integrity checking with a bandwidth cost. Consider metadata verification and sampled full checksum reads if that assurance tradeoff is acceptable. Merely substituting HEAD would lose content-integrity verification.
- The brief-change-image reader can embed database image bytes as base64, but **production currently has zero rows in `brief_change_image`**. It is not an evidenced cause of this incident.
- Storage contains approximately 371.8 MB of objects; that is stored capacity, not monthly egress. Deleting old objects does not undo bandwidth already consumed.
- SQL indexes and HTTP compression alone do not eliminate full records returned from Supabase to Vercel or big-mac. First reduce result width and repeated reads.

## Suggested delivery and verification order

1. Remove repeated archive payload reads while preserving queue service and recovery for missed invalidations. Verify unchanged completed readers do not cause prose/payload reads; source, brief, lens, and prompt revisions must still refresh translations.
2. Narrow list, search, detail, and upsert projections. Compare returned behavior and serialized database results on the same records.
3. Bound Featured in SQL and verify identical winners across score ties and editorial overrides.
4. Bound translation polling, then add image variants. Verify pending/offline behavior and image quality separately.
5. Compare service-level billed egress over matched time windows and traffic, alongside worker scan counts and query rows. The audit's short observation confirms waste; it does not establish the eventual percentage reduction of the 7.42 GB bill.
