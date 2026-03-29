# Architecture

Billion is an AI-powered civic information app. It scrapes government sources (Congress, White House, SCOTUS), enriches the content with AI-generated articles and images, and surfaces it to users through a mobile app and web frontend.

This document covers how the system is structured, why key decisions were made, and what alternatives were considered. See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup, styling conventions, and localtunnel configuration.

---

## Monorepo Structure

```
apps/
  expo/        React Native app (Expo SDK 54, React 19)
  nextjs/      Next.js 15 web app + API host
  scraper/     Standalone Node.js data pipeline
packages/
  api/         tRPC router definitions
  auth/        better-auth configuration
  db/          Drizzle schema, migrations, client
  ui/          Shared shadcn/ui components (web)
  validators/  Shared Zod schemas
tooling/
  eslint/      Shared ESLint presets
  tailwind/    Shared Tailwind theme + CSS variables
  typescript/  Shared tsconfig bases
```

The monorepo is managed with pnpm workspaces and Turborepo. Packages are internal — they are not published to npm.

---

## Data Layer

### Why Drizzle ORM

We use [Drizzle ORM](https://orm.drizzle.team/) with a PostgreSQL backend (hosted on Supabase's Postgres infrastructure).

Drizzle was chosen because:

- **Schema-as-code with full type inference.** The TypeScript types for every query are derived directly from the schema definitions — no codegen step, no type drift. When you change a column, TypeScript immediately catches every affected callsite.
- **Thin abstraction.** Drizzle is close to SQL. There's no magic query builder that hides what's being sent to the database.
- **drizzle-zod integration.** Insert/select schemas can be derived from table definitions with `createInsertSchema`, keeping validation in sync with the DB automatically.

**Why not use the Supabase client directly?**

Supabase provides a PostgREST-based JS client. The main problem is type safety: Supabase generates TypeScript types from your schema via `supabase gen types`, but the resulting types are relatively loose — you get `Json` for JSONB columns, union types that don't fully reflect your actual data shape, and no inference across joins. Drizzle gives us precise inferred types for everything, which matters when the schema is non-trivial (polymorphic references, JSONB columns with typed shapes, etc.).

Using Supabase as the Postgres host is fine. Using the Supabase client as our ORM is where we'd lose too much type fidelity.

### DB Client

`packages/db/src/client.ts` exports a lazy-initialized `db` singleton via a `Proxy`. The actual Drizzle connection isn't created until the first query, which avoids connection setup in environments that import the package without needing it.

The client uses `drizzle-orm/node-postgres` (native TCP connection). This is why **only server-side code can use the DB client directly** — the mobile app runs in a JS runtime without Node.js's `net`/`tls` modules, so there's no way to open a TCP socket to Postgres from a phone.

### Schema Overview

| Table | Purpose |
|---|---|
| `bill` | Congressional legislation scraped from GovTrack and congress.gov |
| `government_content` | Executive orders, memoranda, proclamations, press briefings from whitehouse.gov |
| `court_case` | SCOTUS and federal court cases |
| `video` | AI-generated feed posts derived from the above content |
| auth tables | better-auth managed session/user tables (see `auth-schema.ts`) |

All content tables share a common pattern:
- `content_hash` (SHA-256) — used to detect changes between scrape runs and avoid redundant AI generation
- `versions` (JSONB array) — append-only log of `{ hash, updatedAt, changes }` for every update
- `ai_generated_article` — the AI-enriched markdown article stored directly on the row
- `images` (JSONB array) — `{ url, alt, source, sourceUrl }[]` for scraped thumbnails
- `thumbnail_url` — primary display image URL

The `video` table is a derived feed layer — one row per content item, with a polymorphic reference (`content_type` + `content_id`) back to the source table. It stores AI-generated marketing copy (title ≤25 chars, ~50-word description) and either binary image data (`bytea`) from DALL-E or a URL from the scraped thumbnail.

---

## API Layer

### Why tRPC

The API is implemented as a [tRPC v11](https://trpc.io/) router in `packages/api/`, served by Next.js at `/api/trpc`.

tRPC was chosen because:

- **End-to-end type safety without a schema file.** The router's input/output types flow directly to both the Next.js server components and the Expo client. There's no OpenAPI spec to maintain, no codegen to run, no type drift between client and server.
- **Single package for all clients.** Both `apps/expo` and `apps/nextjs` import `@acme/api` and get identical type-safe access to every procedure.

### Router Structure

| Router | Procedures |
|---|---|
| `auth` | `getSession`, `getSecretMessage` |
| `content` | `getAll`, `getByType`, `getById` |
| `video` | `getInfinite` (paginated feed) |
| `post` | `all`, `byId`, `create`, `delete` |

### Why Next.js is the Single API Host

Next.js at port 3000 serves both the web frontend and the tRPC API. The Expo app points at this same server. This means:

- One auth implementation (better-auth) handles cookies for web and passes them through headers for mobile
- One deployment to maintain in production
- The DB is never exposed outside the server process

---

## Scraper Pipeline

### Overview

`apps/scraper/` is a standalone Node.js process. It runs on demand (or on a schedule) and writes directly to the database via the `@acme/db` client — no HTTP, no tRPC, no auth layer.

**Why direct DB access?** The scraper is a trusted server-side process running in a controlled environment. Going through the tRPC API would add latency, require auth tokens, and expose write endpoints that would need to be secured. Direct Drizzle access is simpler and faster.

### Scrapers

| Scraper | Source | Content Type |
|---|---|---|
| `govtrack.ts` | govtrack.us | Bills |
| `congress.ts` | congress.gov | Bills |
| `whitehouse.ts` | whitehouse.gov | Government content (EOs, memoranda, briefings) |
| `scotus.ts` | Supreme Court | Court cases |

All scrapers use [Crawlee](https://crawlee.dev/) for HTTP crawling. Scrapers are run individually or all at once via CLI: `pnpm scrape [govtrack|whitehouse|congress|scotus|all]`.

### Upsert + Change Detection

Every scrape run computes a SHA-256 hash of the content's key fields. Before running AI generation:

1. Check if an existing row matches the URL/identifier
2. Compare the new hash against the stored `content_hash`
3. If unchanged → skip (no AI calls, no DB write)
4. If changed or new → run AI pipeline, upsert row, append to `versions`

This is the main cost-control mechanism. AI generation is expensive; hashing ensures it only runs when content actually changes.

### AI Pipeline

Each piece of content goes through three AI steps before being stored:

**1. Article generation** (`utils/ai/text-generation.ts`)
- Model: Gemini 2.5 Flash via Vercel AI SDK (`@ai-sdk/google`)
- Produces a structured 4-section markdown article: "What This Means For You", "Overview", "Impact & Implications", "The Debate"
- Written at an 8th-grade reading level, balanced across political perspectives
- Stored in `ai_generated_article` on the content row

**2. Marketing copy generation** (`utils/ai/marketing-generation.ts`)
- Model: Gemini 2.5 Flash with structured output (`generateObject`)
- Produces: title (≤25 chars), description (~50 words), image prompt
- Stored on the `video` row

**3. Image acquisition** (two paths)

*Path A — Scraped thumbnail:* If the source page has a usable image, it's stored as a URL in `thumbnail_url`. This is preferred — no API cost, no generation latency.

*Path B — DALL-E generation* (`utils/ai/image-generation.ts`): If no scraped image is available, DALL-E 3 generates a 1024×1024 photorealistic image from the marketing copy's image prompt. The PNG is downloaded immediately (DALL-E URLs expire after 1 hour), converted to JPEG via `sharp`, and stored as raw bytes in the `image_data` bytea column. Exponential backoff handles rate limits (1s, 2s, 4s).

---

## Frontend Apps

### Expo (Mobile)

The Expo app is the primary user-facing client. It communicates with the backend exclusively through the tRPC HTTP API — it has no direct database access.

**Why can't mobile hit the DB directly?**

Two reasons:

1. **No TCP socket in React Native.** Drizzle's Node.js drivers use `net`/`tls` from Node.js stdlib to open a TCP connection to Postgres. React Native's JS runtime doesn't have those modules. There is no socket layer to connect over.

2. **Security.** Even if it were technically possible, embedding a DB connection string in a mobile app binary means any user can extract it and get unrestricted DB access.

A PostgREST-style HTTP API (like Supabase's) would solve both problems — HTTP works from mobile, and you'd use an anon key + Row Level Security instead of a raw connection string. We'd consider this if we ever moved away from the tRPC architecture, but currently the tRPC layer is where business logic and auth live.

### Next.js (Web)

The Next.js app serves the web frontend and hosts the tRPC API. In production, it's deployed to Vercel. In development, the Expo app tunnels to it via localtunnel (see CONTRIBUTING.md).

### Styling

Both apps share design tokens from `tooling/tailwind/theme.css` and `packages/ui/src/theme-tokens.ts`. The Expo app uses NativeWind v5 for Tailwind-in-React-Native, with pixel conversion helpers (`sp`, `rd`) for rem-to-px translation. All Expo styles are consolidated in `apps/expo/src/styles.ts` — see CONTRIBUTING.md for the full style API.

---

## Considered Alternatives

| Decision | What we chose | What we considered | Why we didn't |
|---|---|---|---|
| ORM | Drizzle | Supabase client, Prisma | Supabase types are too loose; Prisma requires codegen and has more overhead |
| API protocol | tRPC | REST, GraphQL | REST requires manual type maintenance; GraphQL is heavy for this scale |
| Mobile DB access | tRPC over HTTP | Supabase PostgREST + RLS | Would require migrating auth and business logic out of the API layer |
| AI text model | Gemini 2.5 Flash | GPT-4o, Claude | Cost/quality ratio; structured output support via Vercel AI SDK |
| Image storage | bytea in Postgres | S3/R2 object storage | Simpler for now; object storage is the right move at scale |
| Scraper DB access | Direct Drizzle | tRPC mutations | No benefit to HTTP overhead for a trusted server process |
