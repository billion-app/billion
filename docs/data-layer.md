# Data Layer

## Why Drizzle ORM

We use [Drizzle ORM](https://orm.drizzle.team/) over a **PostgreSQL** backend hosted on **Supabase** (connection string points at `pooler.supabase.com:6543`).

Drizzle was chosen because:

- **Schema-as-code with full type inference.** Every query's TypeScript type is derived from the schema definition — no codegen, no type drift. Change a column and TypeScript immediately flags every affected callsite.
- **Thin abstraction.** Drizzle stays close to SQL; there's no opaque query builder hiding what's sent to the database.
- **drizzle-zod integration.** Insert schemas (`createInsertSchema`) are derived directly from table definitions, keeping validation in sync with the DB.

**Why not the Supabase client directly?** Supabase's PostgREST JS client generates relatively loose types (`Json` for JSONB, unions that don't reflect actual data shapes, no inference across joins). With a non-trivial schema — polymorphic references, typed JSONB columns, per-field citation arrays — Drizzle's precise inferred types matter. Using Supabase as the Postgres _host_ is fine; using its client as the _ORM_ loses too much type fidelity.

## DB Client

`packages/db/src/client.ts` exports a lazy-initialized `db` singleton via a `Proxy`. The Drizzle connection (`drizzle-orm/node-postgres`, native `pg` driver, `snake_case` casing) isn't created until the first query, so importing the package never opens a connection on its own.

Because the driver opens a raw TCP socket via Node's `net`/`tls`, **only server-side code can use the DB client directly.** The mobile app's JS runtime has no socket layer (see [Frontend apps](./frontend.md)).

Migrations use `drizzle-kit`. `drizzle.config.ts` strips the pooler port `:6543` down to direct `:5432` for migrations, since DDL doesn't play well with the transaction pooler. Run via `pnpm -F @acme/db push` (or `db:push` from the root); inspect with `db:studio`.

## Schema Overview

The schema (`packages/db/src/schema.ts` + better-auth-generated `auth-schema.ts`) has ~20 tables in five groups.

**Government content** — the scraped source material:

| Table                | Purpose                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| `bill`               | Congressional legislation (congress.gov)                                           |
| `government_content` | Presidential documents — EOs, proclamations, memoranda, notices (Federal Register) |
| `court_case`         | SCOTUS & federal court opinions (CourtListener)                                    |
| `post`               | Legacy sample-post table from the T3 template                                      |

All three content tables share a common pattern:

- `content_hash` (SHA-256 over key fields) — detects changes between scrape runs to avoid redundant AI generation
- `versions` (JSONB array) — append-only `{ hash, updatedAt, changes }` log
- `ai_generated_article` — AI-enriched markdown stored on the row
- `images` (JSONB array) — `{ url, alt, source, sourceUrl }[]`
- `thumbnail_url` — primary display image

**Feed layer:**

| Table   | Purpose                                                                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video` | Derived feed cards — one row per content item via a polymorphic `(content_type, content_id)` ref. Holds AI marketing copy (title ≤25 chars, ~50-word description) and either a JPEG in `image_data` (`bytea`) or a scraped `thumbnail_url`. `engagement_metrics` JSONB. |

**Civic / elections** — the voter-information model:

| Table                      | Purpose                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `election`                 | Election records (external id, date, type, OCD division, deadlines JSONB)                                                                                                                                                                                                                   |
| `contest`                  | Races _and_ ballot measures. `type` = candidate \| referendum. For measures: `referendum_title`, pro/con statements, `summary`, `summary_is_ai_generated`, `fiscal_impact`, and a `citations` JSONB array (per-field source attribution: field, source name/url, trust tier, official flag) |
| `candidate`                | Candidates within a contest (party, incumbent, contact, bio)                                                                                                                                                                                                                                |
| `polling_location`         | Polling places / early-vote sites / drop boxes, geo-located (lat/long), with hours                                                                                                                                                                                                          |
| `role_description`         | Reusable descriptions of offices/roles by level (seeded with ~18 federal→local roles)                                                                                                                                                                                                       |
| `election_source_snapshot` | Provider-neutral, idempotent current-cycle election snapshots with source version, checksum, diagnostics, and source URLs. Texas SOS facts and TLC analyses occupy separate rows.                                                                                                           |

**Local government (Legistar cache)** — `legistar_body`, `legistar_matter`, `legistar_meeting`, `legistar_agenda_item`, `legistar_vote`. These cache San Jose / Santa Clara / Sunnyvale council data (ordinances, meetings, agenda items, votes) keyed by `(jurisdiction, *_id)` with a `fetched_at` timestamp.

**User engagement & caching:**

| Table             | Purpose                                                                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saved_article`   | Bookmarks — polymorphic `(content_type, content_id)` per user                                                                                                                                                               |
| `user_preference` | Preferred topics / content types (JSONB string arrays)                                                                                                                                                                      |
| `blocked_content` | Hidden sources/topics                                                                                                                                                                                                       |
| `user_settings`   | Privacy & consent flags (location, personalize, analytics, crash, offline)                                                                                                                                                  |
| `civic_api_cache` | Google Civic responses **and** enrichment results, keyed by `(address_hash, endpoint, params)` with `expires_at` TTL. Also backs per-candidate enrichment under endpoint `candidate-enrich` (global `address_hash`, 7d TTL) |

**Auth** — better-auth-managed `user`, `session`, `account`, `verification` (regenerated into `auth-schema.ts` via `pnpm auth:generate`).

## Key Relationships

The content tables feed the `video` table and are referenced by `saved_article` through the same polymorphic `(content_type, content_id)` pair — neither uses a foreign key, so the dashed links below denote polymorphic refs, not enforced constraints.

```mermaid
erDiagram
    bill ||..o{ video : "content_type=bill"
    government_content ||..o{ video : "content_type=government_content"
    court_case ||..o{ video : "content_type=court_case"
    user ||--o{ saved_article : bookmarks
    bill ||..o{ saved_article : "polymorphic ref"
    government_content ||..o{ saved_article : "polymorphic ref"
    court_case ||..o{ saved_article : "polymorphic ref"

    election ||--o{ contest : has
    election ||--o{ polling_location : has
    contest ||--o{ candidate : "candidate races"
    role_description }o..o{ contest : "describes office"

    user ||--o{ session : ""
    user ||--o{ account : ""
    user ||--|| user_preference : ""
    user ||--|| user_settings : ""
    user ||--o{ blocked_content : ""

    bill {
        string content_hash "SHA-256 change detection"
        jsonb versions "append-only history"
        text ai_generated_article
        jsonb images
    }
    contest {
        string type "candidate | referendum"
        bool summary_is_ai_generated
        text fiscal_impact
        jsonb citations "per-field attribution"
    }
    video {
        string content_type "polymorphic"
        bytea image_data "AI image, or"
        string thumbnail_url "scraped URL"
    }
    civic_api_cache {
        string address_hash
        timestamp expires_at "TTL: 7d/24h/30d; candidate-enrich 7d"
    }
```
