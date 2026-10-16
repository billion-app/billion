# Combined elections TestFlight review

This integration combines the exact latest heads of PRs #430–#441 without merging those PRs or modifying main. `source-prs.json` records the source commits. The integration branch preserves provider and editorial publication gates.

## Real data and reachable features

The committed Expo API default is `https://www.billion-news.app`. The production California guide returned the November 3, 2026 election, 13 candidate statements and 14 propositions on October 2, 2026. This is a statewide statement guide, not a personalized or complete ballot.

| PR   | Store build behavior                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #431 | Elections entry opens live California guide; personalized lookup remains unavailable and links to election offices. New availability API is absent on current production, handled by recovery. |
| #435 | Sourced process education reachable from Elections; labeled educational examples with editorial review pending, not live candidate status or dates.                                            |
| #433 | Visual office roles where exact office/jurisdiction match; all available live official office duties remain readable in disclosure.                                                            |
| #434 | Candidate source statements and coverage disclosure reachable; independent analysis remains unpublished.                                                                                       |
| #432 | California voting plan linked from live guide; local preferences scoped to current guide election. Official sources supply practical instructions.                                             |
| #430 | Comparison prototypes remain editorially gated; no invented priorities from statements or substitute ballot roster.                                                                            |
| #439 | Contest marking requires verified jurisdiction/contest rules; guide does not fabricate marking instructions.                                                                                   |
| #440 | Coverage and statement provenance visible on live guide/details; metadata disclosure available.                                                                                                |
| #436 | Live official proposition Yes/No descriptions and source detail available; unapproved independent consequence diagrams remain unpublished.                                                     |
| #441 | Real guide races and measures support private reading notes with separate guide identity. No incomplete candidate-choice selector. Saved archive reachable without API.                        |
| #438 | Official language/accessibility voting resources linked from guide.                                                                                                                            |
| #437 | Accountability prototype remains gated; no invented current officeholder actions/results.                                                                                                      |

## Integration decisions

Guide plan and notes open focused routes so utility cards do not bury the real candidate list. One incomplete-roster warning remains visible. Official responsibilities are retained alongside authored office explanations. Device notes omit partial candidate rosters and use a guide-specific election/scope distinct from address-based ballot notes; saved notes have an always-available archive and guide-error recovery.

Screenshots are actual running Expo web at 390×844 using the committed production API. They contain real source data, not synthetic responses. Development-only scenario links may appear in the web capture; production iOS export excludes development scenarios. These captures do not prove native rendering or real-reader comprehension.

## Independent review and verification

Fresh gpt-6-astra reviewed screenshots first, then combined code/contracts. It identified above-fold utility density and inaccessible saved notes when API failed. Both were fixed and re-reviewed. Final verdict: approve reviewed integration code and revised design; no remaining blocking findings. Astra independently ran 47 focused tests successfully. Production native runtime remains unverified before installing TestFlight.

Final checks passed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`, and `NODE_ENV=production pnpm --filter @acme/expo exec expo export --platform ios --output-dir /tmp/billion-elections-ios-export`. Workspace test run includes the release profile tests; notification database integration remains skipped without its dedicated local test database.

Actual interaction check saved a private note for the real guide’s Lieutenant Governor race, aborted all API requests, reloaded the guide notes route and confirmed the local archive still shows that note with its election identity and deletion action. `offline-notes.png` records this recovery state. No production write occurred.

Expo Doctor completed 20/21 checks. The remaining check reports eight Expo SDK patch-version mismatches against SDK57 recommendations. Release owner will address these before building; no compatibility exclusion was added.

## Release preflight

The isolated `elections-review` store profile uses production API/environment with a separate update channel. The standard tag workflow hardcodes the production profile and cannot target this review channel, so this release uses one manual EAS build with the existing production submission profile. No version tag is pushed to trigger a second build.

Expo SDK 57 patch dependencies were aligned with Expo Doctor recommendations. Doctor passes all 21 checks; native iOS prebuild, mobile lint/typecheck, workspace tests, and production iOS export pass. Marketing version is 0.8.4; EAS assigns the remote build number. Astra reviewed the dependency/profile follow-up and found no blockers.
