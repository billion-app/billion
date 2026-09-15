# Documentation

New to Billion? Read the [architecture tour](architecture.md) for the data flow, then [Contributing](../CONTRIBUTING.md) to run the project. You can stop there until you know which area you want to change.

## Understand the implementation

| Guide                                                         | What you will learn                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [Architecture and code tour](architecture.md)                 | How the processes fit together, project terms, and a bill's path to the screen |
| [Frontend apps](frontend.md)                                  | Mobile routes, API clients, styling, auth, and public web pages                |
| [API](api.md)                                                 | Request handling, router responsibilities, validation, and user access         |
| [Data layer](data-layer.md)                                   | Source records versus derived content, database relationships, and migrations  |
| [Scraper pipeline](scraper.md)                                | Source discovery, hashes, retry queues, enrichment, and repair jobs            |
| [Article generation](article-generation.md)                   | Structured briefs, quote verification, and framing rules                       |
| [Measure enrichment](measure-enrichment.md)                   | Evidence and trust tiers for ballot-measure summaries                          |
| [Candidate enrichment](candidate-enrichment.md)               | Source-backed candidate biographies and other fields                           |
| [Local government and Legistar](local-government-legistar.md) | Implemented ingestion and read API, San José policy, and remaining work        |
| [Sharing and saves](virality.md)                              | Public previews, generated share images, bookmarks, and screenshot detection   |

For local Android builds and the path to Google Play, read [Android development and release](android-release.md).

## Work on the project

| Task                                   | Guide                                             |
| -------------------------------------- | ------------------------------------------------- |
| Set up a checkout or check a change    | [Contributing](../CONTRIBUTING.md)                |
| Find the owner of a source integration | [Data sources API reference](data-sources-api.md) |
| Obtain civic provider keys             | [Civic data source setup](civic-data-sources.md)  |
| Change mobile styles                   | [Expo styling](expo-styling.md)                   |
| Connect a phone to a local API         | [Localtunnel](localtunnel.md)                     |
| Diagnose setup failures                | [Troubleshooting](troubleshooting.md)             |

## Operate and release

| Task                                                | Guide                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Configure environment variables or prepare a launch | [Environment and launch](launch.md)                                                        |
| Run a bounded ingestion job                         | [Scraper CLI](../apps/scraper/README.md)                                                   |
| Schedule, deploy, or inspect production jobs        | [Supervisor](../apps/supervisor/README.md) and [big-mac host](../deploy/big-mac/README.md) |
| Change or adopt a database schema                   | [Migrations](data-layer.md#migrations)                                                     |
| Understand historical SQL operations                | [Manual SQL notes](../packages/db/manual-sql/README.md)                                    |
| Ship an iOS binary or production OTA                | [iOS releases](ios-release.md)                                                             |
| Invite waitlist batches to TestFlight               | [Waitlist batches](testflight-waitlist-batches.md)                                         |
| Review collected data and retention                 | [Data inventory](legal/data-inventory.md)                                                  |

## Product context and planning

These documents explain intent or record plans. Use the implementation guides and linked source files to determine current behavior.

- [Brand manifesto](../BRANDING.md) and [positioning](positioning-nonpartisan-vs-partisan.md)
- [Government information structure](government-information-structure.md), background on the civic domain and coverage goals
- [Website product brief](../apps/nextjs/PRODUCT.md) and [website design](../apps/nextjs/DESIGN.md)
- [Midterms 2026 launch decision and verification checklist](midterms-2026-launch-decision.md)
- [Outreach deliverables](outreach-deliverables.md)
- [Historical Expo page implementation notes](../apps/expo/src/new_pages_implementation/README.md)

Agent entry points are [AGENTS.md](../AGENTS.md) and the [TestFlight release skill](../.codex/skills/release-billion-testflight/SKILL.md). Keep developer explanations in these guides and agent workflow instructions in those files.
