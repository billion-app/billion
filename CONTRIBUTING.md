# Contributing

Start with the [architecture tour](docs/architecture.md) if you are still figuring out where your change belongs. This guide gets the project running and explains how to check a change before sharing it. Commands run from the repository root unless a step says otherwise.

## Prerequisites

- Node `>=22.20.0` and pnpm `10.15.1`, as pinned in `package.json`.
- PostgreSQL. Onboarding can use Postgres.app, Homebrew Postgres, or the repository's Docker Compose service.
- For iOS development, macOS with Xcode, command-line tools, and an iOS Simulator. For Android, Android Studio with an SDK, emulator, and compatible JDK. See [Android setup and Google Play release](docs/android-release.md) for installation and release steps.

## Set up a checkout

```bash
git clone https://github.com/billion-app/billion.git
cd billion
pnpm install
pnpm onboard
```

`pnpm install` makes the onboarding script's dependencies available. The wizard can install again, or you can skip that step. It creates `.env` without overwriting an existing file, generates a local `BETTER_AUTH_SECRET`, selects a local database, and offers to apply the schema and seed sample content. It also offers provider configuration, native prebuilds, and a typecheck.

Preview its actions with `pnpm onboard --dry-run --yes`. For a web/API-only checkout, use `pnpm onboard --skip-expo`. See `pnpm onboard --help` for the other flags.

### Choose a local database

Onboarding first preserves an existing local `POSTGRES_URL`, then looks for system Postgres on port `5432`, and finally offers Docker Postgres on `127.0.0.1:54322`. It refuses to apply the schema automatically to a remote-looking URL.

```bash
pnpm postgres:start   # Docker fallback
pnpm postgres:status
pnpm postgres:logs
pnpm postgres:stop    # keeps the named data volume
```

The wizard uses `db:push` for initial local setup. Shared databases use committed migrations. Read [the migration workflow](docs/data-layer.md#migrations) before changing the schema or adopting an existing database.

### Configure the app you are working on

```bash
pnpm env:setup --target nextjs --file .env
pnpm env:doctor --target nextjs --file .env
```

The wizard explains each variable and masks secrets. The doctor reports missing or invalid values without printing them. An empty local database can start the app but has no scraped articles; choose sample data during onboarding for UI work. Civic and Places have development mocks when provider keys are absent, but that does not make every integration work without credentials. Next.js also validates the public PostHog settings.

Root `.env.local` can override root `.env`. Expo also has app-specific files, explained below. If a changed value seems ignored, check [environment loading precedence](docs/launch.md#loading-policy).

`.env.example` is generated from the environment declarations. After changing those declarations, run `pnpm env:example`. Keep real credentials in ignored value files.

## Run the website and API

```bash
pnpm dev:next
```

Open `http://localhost:3000`. This starts Next.js and its workspace dependencies. Keep it running while testing mobile API requests.

## Run the mobile app

Expo commits a production API default in `apps/expo/.env`. For local development, create `apps/expo/.env.local` with the address of your development server:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
```

Replace that example with your computer's LAN address. A physical phone's `localhost` is the phone itself. Use [a tunnel](docs/localtunnel.md) if the phone cannot reach your computer over the local network. Restart Expo after changing the URL.

Build and install a development binary once, and again after adding native dependencies:

```bash
pnpm ios
# Or, for Android:
pnpm android
```

Then run the bundler and API together:

```bash
pnpm dev
```

In Turbo's terminal UI, select `@acme/expo` and press `i` or `a` to open the installed app. You do not need to edit package scripts to choose a platform. Onboarding can prepare native projects, but a prebuild alone does not install a development binary. A clean prebuild regenerates the ignored `apps/expo/ios` or `apps/expo/android` directory.

`pnpm dev` excludes the scraper and supervisor. `pnpm dev:all` includes background jobs that can write data and invoke paid providers; use the [scraper guide](apps/scraper/README.md) to run a bounded job instead of using it for routine UI work.

## Make your first change

| Change                   | Start here                   | Read next                               |
| ------------------------ | ---------------------------- | --------------------------------------- |
| Browse or article detail | `apps/expo/src/app/`         | [Frontend apps](docs/frontend.md)       |
| Mobile appearance        | `apps/expo/src/styles.ts`    | [Expo styling](docs/expo-styling.md)    |
| API behavior             | `packages/api/src/router/`   | [API guide](docs/api.md)                |
| Stored data              | `packages/db/src/schema.ts`  | [Data layer](docs/data-layer.md)        |
| Source ingestion         | `apps/scraper/src/scrapers/` | [Scraper pipeline](docs/scraper.md)     |
| Job timing or retries    | `apps/supervisor/src/`       | [Supervisor](apps/supervisor/README.md) |

Use `pnpm ui-add` for shared web components. Use `pnpm turbo gen init` to scaffold a workspace package. Shared dependency versions belong in the catalog in `pnpm-workspace.yaml`; app-specific dependencies belong in that app's manifest.

## Check your change

Run focused checks while editing, for example:

```bash
pnpm --filter @acme/api test
pnpm --filter @acme/expo typecheck
```

Before submitting code, run the workspace checks that cover it:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```

CI also runs workspace dependency lint, a separate Expo tab-visibility test, and iOS/Android bundle exports. Its exact commands live in [.github/workflows/ci.yml](.github/workflows/ci.yml). Run `pnpm onboard:test` when changing onboarding; the root test script does not include it.

For documentation-only changes, check links, command names, and formatting on the edited files. The root `pnpm format` delegates to package scripts and does not cover root documentation. For example:

```bash
pnpm exec prettier --check README.md CONTRIBUTING.md docs/architecture.md
```

Describe what changed and how you verified it in the PR. When behavior changes, update its guide and retain links to the relevant code. Prefer explaining the data flow over copying entire interfaces or dependency version lists into prose.

### Notification delivery integration test

The delivery regression test uses real Postgres and mocks only the Expo Push HTTP response. Use a separate, empty local database whose name ends in `_test`; never point it at a shared database. Apply the committed migrations before running it:

```bash
createdb billion_notifications_test
POSTGRES_URL=postgresql://localhost/billion_notifications_test pnpm db:migrate
NOTIFICATIONS_TEST_DATABASE_URL=postgresql://localhost/billion_notifications_test pnpm --filter @acme/api exec tsx --test src/lib/notifications/deliver.integration.test.ts
```

The test covers action deduplication in a non-UTC database session, cancelling queued alerts after opt-out or unsave, concurrent enqueue/send workers, test-send isolation, transport failures, Expo rejection, delayed receipt processing, and server history. It skips unless `NOTIFICATIONS_TEST_DATABASE_URL` is explicitly set. Run it directly as above so Turbo cannot reuse cached results from an earlier database state.

## Production work

[iOS releases](docs/ios-release.md), [scraper deployment](apps/supervisor/README.md), and [launch configuration](docs/launch.md) have separate operational steps.

For deliberately running local code against production services, copy `.env.prod.example` to ignored `.env.prod`, fill it in, then run `pnpm run prod -- --check` before `pnpm run prod`. This loads `.env` with `.env.prod` overrides and can write production data. Use the local setup above for ordinary development.

If setup fails, start with [Troubleshooting](docs/troubleshooting.md).
