# Documentation

Start with [CONTRIBUTING.md](../CONTRIBUTING.md) for dev setup. These docs go deeper.

## How the system works

| Doc                                                  | What it covers                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Architecture overview](./architecture.md)           | The big picture: system diagram, monorepo layout, build tooling, and why the key decisions were made |
| [Data layer](./data-layer.md)                        | Drizzle + Supabase Postgres, the schema (~20 tables), migrations                                     |
| [API layer](./api.md)                                | The tRPC router, civic data integrations, request path, LLM provider                                 |
| [Ballot-measure enrichment](./measure-enrichment.md) | How measure summaries are cross-validated across official sources, adapter by adapter                |
| [Candidate enrichment](./candidate-enrichment.md)    | The same cross-validation pattern applied to candidate bios/photos/contact info                      |
| [Scraper pipeline](./scraper.md)                     | The standalone content scraper: sources, change detection, AI generation                             |
| [Frontend apps](./frontend.md)                       | Expo mobile app, Next.js web, shared UI, cross-platform auth                                         |

## How to do things

| Doc                                                       | What it covers                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Civic data source setup](./civic-data-sources.md)        | Getting API keys / access for every civic integration                            |
| [Expo styling guide](./expo-styling.md)                   | The `~/styles` API: tokens, helpers, pre-built styles                            |
| [Launch guide](./launch.md)                               | Production launch checklist and required environment variables                   |
| [iOS release builds](./ios-release.md)                    | Building and shipping to TestFlight locally (no EAS)                             |
| [Marketing video playbook](./marketing-video-playbook.md) | Recording, automatically editing, reviewing, and measuring daily Instagram Reels |
| [Localtunnel setup](./localtunnel.md)                     | Exposing your dev server so a phone can reach it                                 |
| [Troubleshooting](./troubleshooting.md)                   | Known failure modes and their fixes                                              |

## Project planning

| Doc                                                 | What it covers                                        |
| --------------------------------------------------- | ----------------------------------------------------- |
| [Outreach deliverables](./outreach-deliverables.md) | Data-source outreach tracking and definitions of done |
