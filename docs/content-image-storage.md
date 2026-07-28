# Content image delivery

Generated editorial JPEGs are stored in the public Supabase Storage bucket
`content-images`. Postgres stores only the object path, checksum, dimensions,
MIME type, verification state, and temporary rollback bytes.

The shared delivery order is:

1. source thumbnail
2. generated Storage object
3. temporary `/api/content-images/legacy/:videoId` bytea fallback
4. native placeholder

Object keys are immutable and content-addressed:

`content/{contentType}/{contentId}/{sha256}.jpg`

Uploads set a one-year CDN cache lifetime. Expo uses `memory-disk` image caching,
and slow-changing React Query data is fresh for 15 minutes and retained for 24
hours.

## Rollout

1. Apply Drizzle migration `0009_previous_blazing_skull.sql`. It creates the
   public bucket with a 5 MB limit and JPEG-only MIME restriction. No
   `anon`/`authenticated` upload policy is created; only a server-side Supabase
   secret/service-role key can write.
2. Configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the API/scraper runtime.
   Never expose the secret key to Expo or browser bundles.
3. Preview a bounded batch:

   `pnpm --filter @acme/scraper backfill-content-images -- --batch-size 50`

4. Apply batches until `legacy_rows` with no Storage path reaches zero:

   `pnpm --filter @acme/scraper backfill-content-images -- --apply --batch-size 50`

   Every upload is downloaded and SHA-256 verified before its path is recorded.
   Failures remain in Postgres with an attempt count and error for the next run.

5. Verify image loading and CDN behavior in production. Keep the legacy endpoint
   and bytes for at least the rollback window.
6. Preview cleanup, then clear only verified blobs older than the window:

   `pnpm --filter @acme/scraper backfill-content-images -- --cleanup --rollback-days 14`

   `pnpm --filter @acme/scraper backfill-content-images -- --cleanup --rollback-days 14 --apply`

Regeneration removes the superseded object after the new version and database
path are durable. A cleanup failure is logged without rolling back the new
image.

## Measurement record

Capture the following before step 4 and after step 6 for the same traffic
window. The backfill command prints the first four database counters.

| Metric                                      | Before | After | Source                    |
| ------------------------------------------- | -----: | ----: | ------------------------- |
| Legacy blob rows                            |        |       | backfill command          |
| Legacy blob bytes                           |        |       | backfill command          |
| Verified Storage rows / failures            |        |       | backfill command          |
| Database egress                             |        |       | Supabase Database reports |
| Storage origin / cached egress              |        |       | Supabase Storage reports  |
| CDN cache-hit ratio                         |        |       | Supabase Storage reports  |
| tRPC response bytes and p95 latency         |        |       | API observability         |
| Expo image failures / placeholder fallbacks |        |       | mobile telemetry          |

Do not remove the blob columns or legacy route until the table is filled with
production values and the rollback window has elapsed.
