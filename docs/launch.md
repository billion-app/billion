# Launch and Environment Configuration

This is the operating guide for configuration across the monorepo. The typed
registry in `packages/env/src/registry.ts` owns variable metadata and Zod
schemas; adjacent scraper `*.config.ts` files own each scraper's requirements.
Together they drive setup prompts, the doctor, generated templates, and
fail-fast validation. `.env.example` is generated and contains no real secrets.

## Environment commands

The CLI uses Yargs for commands/options and Clack for interactive prompts. It
masks secret input, never prints configured values, and only asks for variables
belonging to the selected app surface.

```bash
# Guided setup, including why each value exists and where to obtain it
pnpm env:setup

# Walk every app surface; contributor onboarding uses this comprehensive mode
pnpm env:setup --target all

# Configure only one scraper's file
pnpm env:setup --target scraper --scraper congress --file .env.scraper.local

# Validate a local file without printing values
pnpm env:doctor --target scraper --scraper congress --file .env.scraper.local

# Validate variables injected into a CI job or deployed process
pnpm env:doctor --target scraper --scraper congress --source process

# Generate a secret-free deployment checklist/template
pnpm env:template --target scraper --scraper congress --output .env.scraper.example

# Regenerate the repository-wide example after changing the registry
pnpm env:example
```

`required` values make the doctor fail. `recommended` values produce warnings
but do not fail it. `optional` values are still validated when present.

## Loading policy

There is one contract, but not one universal loader:

- Next.js keeps its native environment loading because its build/runtime
  behavior and client-variable rules are framework-owned.
- Expo keeps its native `EXPO_PUBLIC_*` replacement because those values are
  compiled into the app bundle.
- Local Node tools (scrapers, Drizzle, and seeds) call the
  shared `@acme/env/load` loader. It reads root `.env.local`, then root `.env`,
  without overwriting variables already supplied by the shell.
- Production processes do not load files. The hosting platform, container
  scheduler, or secret-manager agent injects variables into `process.env`.

Do not add new `dotenv`, `dotenv-cli`, `with-env`, or ad hoc `@next/env` calls.
Add the variable to the registry and use the loader appropriate to the runtime.

## Requirement labels

- **Startup required** — the process will fail validation, fail during module
  loading, or cannot perform its primary job without the variable.
- **Launch required** — the process may start, but a user-facing launch feature
  will be broken or will serve mock data.
- **Feature required** — only the named feature or job needs it.
- **Optional** — the code has a fallback, skips enrichment, or uses a default.
- **Platform provided** — Vercel, Expo, Node, or CI owns it; do not normally add
  it to `.env` yourself.

## Where variables belong

| Runtime                 | Configure variables in                                   | Important boundary                                                                              |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Next.js website and API | Vercel project settings; root `.env` locally             | Server secrets only. This app currently exposes no `NEXT_PUBLIC_*` variables.                   |
| Expo mobile app         | EAS environment variables; root `.env` locally           | Every `EXPO_PUBLIC_*` value is compiled into the client and is public. Never put secrets there. |
| Scraper container/jobs  | Container or scheduler secret store; root `.env` locally | All keys are server-side. The development command loads the root `.env`.                        |
| Database tooling        | Shell/CI secret store; root `.env` locally               | `POSTGRES_URL` grants direct database access and must remain secret.                            |

Do not commit a populated `.env`. Use separate keys for development and
production where providers support it, restrict keys to only the APIs they
need, and rotate any value that appears in logs or source control.

## Production launch minimum

These variables cover the website/API, a production mobile build, real civic
data, email workflows, and the registered scraper suite:

| Variable                | Requirement      | Runtime                                      | Why                                                                                                   |
| ----------------------- | ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POSTGRES_URL`          | Startup required | Next.js, DB tooling; all DB-writing scrapers | Stores application, auth, civic-cache, and scraped-content data.                                      |
| `BETTER_AUTH_SECRET`    | Startup required | Next.js                                      | Signs/encrypts Better Auth data.                                                                      |
| `RESEND_API_KEY`        | Feature required | Next.js                                      | Waitlist contact management and feedback email use it.                                                |
| `EXPO_PUBLIC_API_URL`   | Launch required  | Expo build                                   | Tells the installed app where the production Next.js/tRPC API lives.                                  |
| `GOOGLE_CIVIC_API_KEY`  | Launch required  | Next.js API                                  | Enables real voter information; otherwise civic endpoints can return development mock data.           |
| `GOOGLE_PLACES_API_KEY` | Launch required  | Next.js API                                  | Enables production address autocomplete and place details.                                            |
| `DEEPSEEK_API_KEY`      | Feature required | Content-enriching scrapers                   | Required by `federalregister`, `congress`, and `scotus`; cache-only civic scrapers do not require it. |
| `CONGRESS_API_KEY`      | Feature required | `congress` scraper                           | Authenticates Congress.gov bill ingestion.                                                            |

`BFL_API_KEY` is strongly recommended for a complete feed, but it is not a hard
scraper startup requirement: without it, raw content and AI text can still be
stored, while generated feed images are omitted. Likewise, optional enrichment
keys below improve coverage but do not prevent the core app from starting.

## Next.js website and API

### Core server configuration

| Variable             | Requirement      | Used for                                 | Missing behavior                                                    | Where to get it                                                                                                                                                                                              |
| -------------------- | ---------------- | ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_URL`       | Startup required | Drizzle, Better Auth, tRPC data access   | Next.js environment validation fails or the first DB access throws. | Supabase project dashboard → **Connect** → connection string. See [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).                                             |
| `BETTER_AUTH_SECRET` | Startup required | Better Auth signing/encryption           | Next.js environment validation fails.                               | Generate a high-entropy secret, for example `openssl rand -base64 32`; see [Better Auth installation](https://www.better-auth.com/docs/installation).                                                        |
| `RESEND_API_KEY`     | Feature required | Waitlist Contacts API and feedback email | The app starts, but those actions fail with a configuration error.  | [Resend API Keys](https://resend.com/docs/dashboard/api-keys/introduction). Use **Full access** because the waitlist reads and mutates contacts, segments, and topics in addition to sending feedback email. |

For Supabase, copy the connection string rather than assembling it manually.
The usual production choice for Vercel is the transaction pooler (`:6543`),
which is intended for transient/serverless connections. A persistent scraper
container can use a direct connection when IPv6 is available or session mode
(`:5432`) when it is not. The current Drizzle migration config converts a
`:6543` pooler URL to `:5432` for schema operations.

If a provider gives you a URL with a password placeholder, replace the
placeholder with `encodeURIComponent(password)`, not the raw password and not an
encoded copy of the whole URL. For example, password `p@ss/word#1` becomes
`p%40ss%2Fword%231` inside the URL. Characters such as `@`, `/`, `#`, `?`, `%`,
and `:` can otherwise be interpreted as URL structure. A complete connection
string copied from the provider is normally already safe to paste.

### Email behavior

| Variable                         | Requirement | Used for                                                       | Default / missing behavior                                                                                                                                                    | Where to get it                                                                                                                  |
| -------------------------------- | ----------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `FEEDBACK_TO_EMAIL`              | Recommended | Feedback recipient list                                        | Defaults to the maintainer address currently hard-coded in `packages/api/src/router/feedback.ts`. Set this explicitly for production; comma-separated addresses are accepted. | An inbox monitored by the team.                                                                                                  |
| `FEEDBACK_FROM_EMAIL`            | Recommended | Feedback sender identity                                       | Defaults to `Billion Feedback <onboarding@resend.dev>`, which is unsuitable for a general production sender.                                                                  | Verify a domain in [Resend Domains](https://resend.com/docs/dashboard/domains/introduction), then use an address on it.          |
| `RESEND_WAITLIST_SEGMENT_ID`     | Optional    | Adds waitlist contacts to an internal segment                  | Contacts are still created globally, but are not assigned to a segment.                                                                                                       | Create/copy a segment in the Resend Audience dashboard; see [Segments](https://resend.com/docs/dashboard/segments/introduction). |
| `RESEND_LAUNCH_UPDATES_TOPIC_ID` | Optional    | Opts waitlist contacts into a user-facing launch-updates topic | Contacts are created without that topic subscription.                                                                                                                         | Create/copy a topic in Resend; see [Topics](https://resend.com/docs/knowledge-base/why-use-topics).                              |

### Civic and address data

| Variable                | Requirement      | Used for                                                             | Default / missing behavior                                                                                            | Where to get it                                                                                                                                                                                                                             |
| ----------------------- | ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CIVIC_API_KEY`  | Launch required  | Elections, representatives, polling locations, and voter information | Some civic calls use mock development data; explicit live voter-info calls can report that the key is not configured. | Create a server key in [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials), enable the [Civic Information API](https://developers.google.com/civic-information/docs/using_api), and restrict the key to that API. |
| `GOOGLE_PLACES_API_KEY` | Launch required  | Address autocomplete and place details                               | Falls back to `GOOGLE_API_KEY`, then `GOOGLE_CIVIC_API_KEY`, then local mock suggestions.                             | Enable **Places API (New)** and create a restricted server key; see [Places setup](https://developers.google.com/maps/documentation/places/web-service/cloud-setup).                                                                        |
| `OPEN_STATES_API_KEY`   | Feature required | California state bills, legislators, and voting records              | Open States-backed enrichments are skipped or return no enrichment.                                                   | [Open States account/API keys](https://openstates.org/accounts/profile/).                                                                                                                                                                   |
| `VOTE_SMART_API_KEY`    | Feature required | Candidate and state-measure enrichment                               | Vote Smart-backed adapters skip enrichment.                                                                           | Request access from [Vote Smart](https://votesmart.org/share/api).                                                                                                                                                                          |

Use a dedicated `GOOGLE_PLACES_API_KEY` in production even though the code has
fallbacks. It allows tighter API restrictions and keeps Places usage separate
from Civic and Custom Search quotas.

### AI used by API-side enrichment

| Variable           | Requirement          | Used for                       | Default / missing behavior                                                | Where to get it                                                  |
| ------------------ | -------------------- | ------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `DEEPSEEK_API_KEY` | Optional for Next.js | API-side civic text generation | Falls back to OpenAI when configured; otherwise AI enrichment is skipped. | [DeepSeek API platform](https://platform.deepseek.com/api_keys). |
| `OPENAI_API_KEY`   | Optional fallback    | API-side civic text generation | Used only when DeepSeek is absent; it is not used by the scraper.         | [OpenAI API keys](https://platform.openai.com/api-keys).         |

### Authentication providers and platform values

| Variable                        | Requirement                     | Used for                                            | Notes                                                                                                                                                                                      |
| ------------------------------- | ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_DISCORD_ID`               | Feature required                | Discord sign-in                                     | Set together with `AUTH_DISCORD_SECRET`; leaving both absent disables Discord as a provider. Create an app in the [Discord Developer Portal](https://discord.com/developers/applications). |
| `AUTH_DISCORD_SECRET`           | Feature required                | Discord sign-in                                     | Server secret; never expose it to Expo or browser code.                                                                                                                                    |
| `VERCEL_ENV`                    | Platform provided               | Selects production, preview, or local auth base URL | Vercel supplies it.                                                                                                                                                                        |
| `VERCEL_URL`                    | Platform provided               | Preview deployment URL and server-side tRPC origin  | Vercel supplies it.                                                                                                                                                                        |
| `VERCEL_PROJECT_PRODUCTION_URL` | Platform provided               | Stable production auth callback URL                 | Vercel supplies it. Confirm the project has a production domain before enabling OAuth.                                                                                                     |
| `PORT`                          | Optional local/runtime override | Local Next.js/tRPC origin fallback                  | Defaults to `3000`.                                                                                                                                                                        |

`AUTH_REDIRECT_PROXY_URL` is mentioned in older local-tunnel documentation and
is present in `turbo.json`, but application code does not currently read it.
Do not treat it as a launch requirement without reintroducing a consumer.

## Expo mobile app

| Variable              | Requirement     | Used for                                   | Missing behavior                                                                                                      | Where to configure it                                                                                                                                                                 |
| --------------------- | --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | Launch required | Base URL for `/api/trpc` and auth requests | Local development attempts host auto-detection; an installed production build has no reliable fallback and can throw. | Add the public HTTPS origin, such as `https://app.example.com`, to the EAS production environment. See [EAS environment variables](https://docs.expo.dev/eas/environment-variables/). |

Do not append `/api/trpc`; the client appends it. Do not use a trailing slash.
Because this is an `EXPO_PUBLIC_*` variable, its value is visible in the app
bundle. It must contain only the public API origin, never an API key or secret.

## Scraper and scheduled data jobs

The registered CLI scrapers are `federalregister`, `congress`, `scotus`,
`scc-cvig`, and `ca-sos-statements`. The VOTE411, LAO cache, and VIG archive
implementations are retained under `scrapers/disabled` but are not runnable or
scheduled because the app does not consume their output.

### Shared scraper variables

| Variable                       | Requirement                      | Used for                                                                                   | Missing behavior                                                                                                                                                                                                           | Where to get it                                                                                                                                         |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`             | Required for content enrichment  | Shared `deepseek-v4-flash` provider for articles, summaries, image keywords, and feed copy | Environment validation fails before `federalregister`, `congress`, or `scotus` starts. Cache-only civic scrapers do not require it.                                                                                        | [DeepSeek API platform](https://platform.deepseek.com/api_keys).                                                                                        |
| `POSTGRES_URL`                 | Required for all active scrapers | Raw content, civic cache, AI fields, and feed rows                                         | Zod validation fails before a scraper starts.                                                                                                                                                                              | Copy a provider connection string. When substituting credentials yourself, percent-encode only the username/password components, not the whole URL.     |
| `BFL_API_KEY`                  | Recommended                      | FLUX-generated feed-card images for content scrapers                                       | Image generation logs an error and returns `null`; raw content, AI text, and any Google thumbnail can still persist.                                                                                                       | Create a key under API → Keys in the [BFL dashboard](https://dashboard.bfl.ai); see the [BFL quick start](https://docs.bfl.ai/quick_start/get_started). |
| `BFL_MODEL`                    | Optional                         | Selects the BFL image model                                                                | Defaults to `flux-2-klein-9b`. Only change this to a model endpoint supported by the current request payload.                                                                                                              | [BFL model documentation](https://docs.bfl.ai/).                                                                                                        |
| `GOOGLE_API_KEY`               | Optional pair                    | Google Custom Search image thumbnails                                                      | Image search is skipped unless both Google variables are present. Existing customers get 100 free queries/day; the API is scheduled for discontinuation on January 1, 2027. This key is also a Places fallback in the API. | Create a restricted server key in [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) and enable Custom Search JSON API.      |
| `GOOGLE_SEARCH_ENGINE_ID`      | Optional pair                    | Programmable Search Engine identifier (`cx`)                                               | Image search is skipped unless both Google variables are present.                                                                                                                                                          | Create a search engine in [Programmable Search Engine](https://programmablesearchengine.google.com/).                                                   |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional                         | Gemini vision fallback for PDF candidate statements                                        | `scc-cvig` uses text-layer PDF extraction only and skips the vision fallback.                                                                                                                                              | Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).                                                                             |
| `SCRAPER_FORCE_AI_REGEN`       | Optional operational flag        | Forces AI field regeneration for unchanged rows                                            | Default is off. Set exactly `1` for a deliberate backfill; it can incur substantial API cost.                                                                                                                              | Set manually for one controlled job.                                                                                                                    |

### Per-scraper requirements

Each scraper owns a lightweight adjacent `*.config.ts` declaration containing
its source and environment requirements. Both `env:setup` and runtime Zod
validation consume those declarations. An `all` run validates their union.

| CLI name            | Required variables                                     | Optional source/enrichment variables                             | Notes                                                                                      |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `federalregister`   | `POSTGRES_URL`, `DEEPSEEK_API_KEY`                     | `BFL_API_KEY`; `GOOGLE_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`      | Uses the keyless Federal Register API.                                                     |
| `congress`          | `POSTGRES_URL`, `DEEPSEEK_API_KEY`, `CONGRESS_API_KEY` | `BFL_API_KEY`; Google image-search pair                          | Get a free Congress key from [Congress.gov API signup](https://api.congress.gov/sign-up/). |
| `scotus`            | `POSTGRES_URL`, `DEEPSEEK_API_KEY`                     | `COURTLISTENER_API_KEY`, `BFL_API_KEY`; Google image-search pair | Runs anonymously at lower CourtListener rate limits when its token is absent.              |
| `scc-cvig`          | `POSTGRES_URL`                                         | `GOOGLE_GENERATIVE_AI_API_KEY`                                   | Text-layer PDF extraction still runs; Gemini is only a fallback.                           |
| `ca-sos-statements` | `POSTGRES_URL`                                         | None                                                             | Uses public California SOS voter-guide pages.                                              |

### Per-run source limits

Use `--max-items 10` for a one-off override, or configure the scraper-specific
variable below. A once-daily schedule makes a per-run limit an effective daily
limit; retries and additional invocations each receive a fresh allowance.

| Variable                        | Default | Unit                                |
| ------------------------------- | ------: | ----------------------------------- |
| `FEDERALREGISTER_MAX_ITEMS`     |      20 | Federal Register documents          |
| `CONGRESS_MAX_ITEMS`            |     100 | Congress.gov bills                  |
| `SCOTUS_MAX_ITEMS`              |      50 | CourtListener opinion clusters      |
| `SCC_CVIG_MAX_ITEMS`            |      10 | Santa Clara voter-guide PDFs        |
| `CA_SOS_MAX_ITEMS`              |       9 | California SOS office pages         |
| `SCRAPER_MAX_NEW_ITEMS_PER_RUN` |      10 | New records receiving AI/image work |

The last setting is an enrichment budget, not a source-fetch limit. Raw records
beyond that enrichment budget are still stored and can be enriched later.

`COURTLISTENER_API_KEY` is an authentication token despite its historical
`*_API_KEY` name. Send it only to CourtListener and store it as a secret.

### Scraper cost-reporting overrides

These do not alter provider billing; they only change the estimates printed by
the scraper. Invalid, empty, or zero values fall back to the defaults shown.

| Variable              | Default | Tracks                                                          |
| --------------------- | ------: | --------------------------------------------------------------- |
| `LLM_INPUT_PRICE`     |  `0.14` | DeepSeek V4 Flash input estimate ($/1M tokens, cache-miss rate) |
| `LLM_OUTPUT_PRICE`    |  `0.28` | DeepSeek V4 Flash output estimate ($/1M tokens)                 |
| `VISION_INPUT_PRICE`  |  `0.30` | Gemini 2.5 Flash vision input estimate ($/1M tokens)            |
| `VISION_OUTPUT_PRICE` |  `2.50` | Gemini 2.5 Flash vision output estimate ($/1M tokens)           |
| `FLUX_IMAGE_PRICE`    | `0.015` | Cost estimate per generated BFL image                           |
| `GOOGLE_SEARCH_PRICE` | `0.005` | Cost estimate per Custom Search request after the free quota    |

## Build, CI, and framework-owned variables

`NODE_ENV`, `CI`, `npm_lifecycle_event`, `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`,
and `VERCEL_PROJECT_PRODUCTION_URL` are supplied by the runtime or build
platform. They influence validation, logging, test retries, and URL selection.
Do not copy fixed production values into `.env.example`.

## Known unused or obsolete names

- `CA_SOS_API_KEY` is not read by application or scraper code. California
  election results and voter-guide sources currently use keyless public feeds.
- `AUTH_REDIRECT_PROXY_URL` has no current application-code consumer.
- `OPENAI_API_KEY` is an API-side fallback only; the scraper requires DeepSeek
  and does not fall back to OpenAI.

## Local setup

From the repository root:

```bash
pnpm onboard
```

Contributor onboarding prefers an existing local Postgres (including
Postgres.app and Homebrew services) and falls back to the repository's Docker
Compose service on `127.0.0.1:54322`. It creates `.env`, generates the local auth
secret, applies the Drizzle schema, offers the same environment wizard, and can
prepare Expo native projects. See
[CONTRIBUTING.md](../CONTRIBUTING.md) for flags and the full decision order.

The normal scraper development command loads root `.env.local` first, then root
`.env`. Existing shell values win:

```bash
pnpm --filter @acme/scraper run start -- federalregister --concurrency 1
```

`pnpm --filter @acme/scraper build` uses Vite to produce Node ESM artifacts.
The stable production entries are `dist/main.js` for the scraper CLI and
`dist/retroactive-videos.js` for the retroactive-video job; Vite may also emit
shared chunks, so deploy the complete `dist/` directory. The production scraper
command remains `node dist/main.js`. It does **not** load an env file or contain
build-time environment values; inject variables through the
container/scheduler environment.

## Deployment and a central secret manager

The registry deliberately stores metadata and schemas, never secret values. A
central secret manager should be the source of truth for production values,
while Vercel, EAS, Render, Fly.io, or a self-hosted scheduler remains the final
delivery layer. This keeps one inventory without copying every secret into
every app.

Use one path or namespace per environment and surface, for example
`production/nextjs`, `production/expo`, and `production/scraper`. Grant each
deployment access only to its own path. In particular, Expo should receive only
`EXPO_PUBLIC_API_URL`; it must never receive database or provider secrets.

The deployment-neutral workflow is:

1. Generate a target template with `pnpm env:template`.
2. Create only those keys in the chosen central manager.
3. Let the platform integration or deploy job inject that target's keys.
4. Run `pnpm env:doctor --target ... --source process` before starting the app
   or scraper.

This works whether the scraper lands on Render, Fly.io, Docker Compose, or a
self-hosted scheduler. A future provider adapter can automate syncing from a
chosen manager; the registry and CLI do not need to change, and the repository
never becomes a production-secret store.

## Launch verification

### 1. Validate builds and configuration

```bash
pnpm typecheck
pnpm build
pnpm --filter @acme/scraper build
test -f apps/scraper/dist/main.js
test -f apps/scraper/dist/retroactive-videos.js
```

The final two checks exercise the scraper's Vite build directly and verify only
its stable entry-point contract. Shared chunk names are intentionally not part
of launch verification.

### 2. Apply and inspect the database schema

```bash
pnpm db:push
```

Use a non-production database for rehearsal. `db:push` changes schema and
should not be treated as a read-only connectivity check.

### 3. Run scraper smoke tests separately

Running the scrapers one at a time makes a missing source-specific key or
upstream outage obvious:

```bash
pnpm --filter @acme/scraper run start -- federalregister --concurrency 1
pnpm --filter @acme/scraper run start -- scotus --concurrency 1
pnpm --filter @acme/scraper run start -- congress --concurrency 1
pnpm --filter @acme/scraper run start -- scc-cvig --concurrency 1
pnpm --filter @acme/scraper run start -- ca-sos-statements --concurrency 1
```

Only after those pass, run the concurrent suite:

```bash
pnpm --filter @acme/scraper run start -- all --concurrency 1
```

### 4. Inspect persisted content

```bash
psql "$POSTGRES_URL" -c "select title, length(full_text), left(full_text, 300) from government_content order by updated_at desc limit 5;"
psql "$POSTGRES_URL" -c "select bill_number, length(full_text), left(full_text, 300) from bill order by updated_at desc limit 5;"
psql "$POSTGRES_URL" -c "select case_number, length(full_text), left(full_text, 300) from court_case order by updated_at desc limit 5;"
```

Look for raw HTML, repeated navigation text, broken PDF columns, extremely
short `full_text`, and encoding damage before forcing any AI regeneration.

### 5. Exercise user-facing launch paths

- Submit the website waitlist form and confirm the Resend contact, optional
  segment, and optional topic membership.
- Submit feedback from the mobile app and confirm delivery from the verified
  sender to `FEEDBACK_TO_EMAIL`.
- In a production mobile build, test address autocomplete, ballot lookup,
  representatives, and polling-place responses against a real address.
- Test auth callback URLs on both a Vercel preview and the production domain if
  a social provider is enabled.

## Keeping the registry, docs, and `.env.example` current

When adding or removing an environment-variable read:

1. Add or update the definition in `packages/env/src/registry.ts`, including
   its surface, requirement, secret flag, explanation, schema, and setup URL.
2. For a scraper-specific value, declare its requirement in that scraper's
   adjacent `*.config.ts`; do not add a per-scraper matrix to the env package.
3. Reuse the exported schema at a runtime boundary when applicable.
4. Run `pnpm env:example`; do not hand-edit `.env.example`.
5. Update the relevant runtime and feature table in this guide.
6. Update `turbo.json` if a Turbo task must receive or hash the variable.
7. Document whether absence prevents startup, disables one feature, produces
   mock data, or merely changes an operational default.

Useful audit command:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' \
  --glob '!**/.next/**' --glob '!**/dist/**' \
  'process\.env|import\.meta\.env|Deno\.env|getenv' .
```

## Related documentation

- [Scraper pipeline](./scraper.md)
- [Civic data sources](./civic-data-sources.md)
- [Data layer](./data-layer.md)
- [iOS release builds](./ios-release.md)
- [Localtunnel setup](./localtunnel.md)
