# Working in Billion

Read [the architecture tour](docs/architecture.md) when a task crosses packages or the data path is unclear. [CONTRIBUTING.md](CONTRIBUTING.md) owns setup and verification commands; [docs/README.md](docs/README.md) indexes specialist guides.

## Repository-specific constraints

- For consumer explanations, assume no prior political or subject knowledge. Follow the [audience and reading hierarchy](docs/content-detail-design.md#audience-zero-assumed-knowledge); explain essential concepts before asking readers to explore.

- Expo reaches server data through tRPC. Keep `@acme/db/client` and server credentials out of mobile and browser bundles.
- Use the package names in `package.json` for pnpm filters. They retain the `@acme/*` prefix. `pnpm dev` excludes ingestion; `pnpm dev:all` starts background jobs as well.
- Check the selected database before migrations, seeds, scraper runs, or repair commands. Root `.env.local` can override `.env`; Expo has its own local override. Inspect variable names and target hosts without printing credentials.
- Use committed Drizzle migrations for shared databases. Preserve applied migrations; add a forward migration. `db:push` is limited to disposable local work. Read [the data-layer guide](docs/data-layer.md#migrations) before schema or baseline work.
- Treat `apps/scraper/src/scrapers.ts` as the active source registry and `apps/supervisor/src/config.ts` as the production job configuration. Bound ingestion tests by source and item count; generation can spend money and write durable data.
- Preserve source citations and the distinction between source text and generated explanation. Read [measure enrichment](docs/measure-enrichment.md), [candidate enrichment](docs/candidate-enrichment.md), or [article generation](docs/article-generation.md) before changing the corresponding pipeline.

## Read when relevant

| Task                                                | Instructions and reference                                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo UI or navigation                               | [Frontend guide](docs/frontend.md), [styling guide](docs/expo-styling.md). Check both Expo Router options and the custom `TabBar`; visibility differs in production. |
| API or authentication                               | [API guide](docs/api.md), then the affected router and `packages/api/src/trpc.ts`.                                                                                   |
| Environment variables                               | [Launch guide](docs/launch.md). Edit the registry or scraper contract, then regenerate `.env.example` with `pnpm env:example`.                                       |
| Scraper behavior or repair                          | [Scraper pipeline](docs/scraper.md) and [CLI guide](apps/scraper/README.md). Check the specific command's write and budget flags.                                    |
| Production scraper deployment                       | [Supervisor operations](apps/supervisor/README.md) and [host setup](deploy/big-mac/README.md).                                                                       |
| iOS build, TestFlight submission, or release status | [Release skill](.codex/skills/release-billion-testflight/SKILL.md).                                                                                                  |
| Production OTA update                               | [iOS release guide](docs/ios-release.md#production-ota-updates). Keep the native fingerprint guard intact.                                                           |

## Verification and documentation

Use focused package checks during development and the applicable checks in [Contributing](CONTRIBUTING.md#check-your-change) before finishing. A production-only mobile change needs a production bundle or runtime check. For docs-only changes, verify relative links, commands against package scripts, formatting, and the final diff.

Write developer docs for a person learning the system. Explain the behavior and its reason, then link to concrete entry points. Keep commands in the relevant setup or operations guide. Keep agent instructions here and release procedure in the release skill; `CLAUDE.md` imports this file rather than duplicating it. Label historical notes and proposed work so readers can distinguish them from implemented behavior.
