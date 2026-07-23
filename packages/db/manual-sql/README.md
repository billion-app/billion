# manual-sql

One-off operations that were applied by hand against the database. These are
historical records, not part of the Drizzle migration pipeline: they either
mutate data or enable database infrastructure that Drizzle cannot represent.

Do not re-run these blindly; they have already been applied to production. They
are kept for provenance only.

| File                            | What it did                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_thumbnailurl_to_video.sql` | Backfilled `video.thumbnail_url` from the source content tables (the column itself is now in `schema.ts` and the baseline migration).       |
| `enable_pg_trgm.sql`            | Enabled the PostgreSQL trigram extension required by fuzzy-search indexes. New databases enable it through the generated migration history. |
| `remove_govtrack_bills.sql`     | Deleted GovTrack-sourced bills that overlapped with congress.gov.                                                                           |

Schema DDL that used to live here (image fields, ballot-measure enrichment
fields) is now captured by `drizzle/` migrations and `src/schema.ts`.

For schema changes going forward, edit `src/schema.ts` and run
`pnpm db:generate` — see [`docs/data-layer.md`](../../../docs/data-layer.md).
