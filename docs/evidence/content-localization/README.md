# News-card translation correction

Captured on 2026-10-18 from the running Expo web development build at phone widths of 390 and 320 pixels. The local tRPC server used current production source records and the durable production translation cache; these are not fixture cards or design mockups. Bounded worker runs generated the translations. This is browser rendering evidence, not proof of installation on a physical iPhone.

The correction covers the English headlines and summaries visible in the user's screenshot after interface localization shipped in [PR #495](https://github.com/billion-app/billion/pull/495). Card text now follows the selected language across Home, Browse, search, saved articles, and sponsor-related bills. Official identifiers and original quotations remain intact.

- [Chinese Home, 390px](home-zh-390.png): the actual CA SB 492 headline and summary, plus the translated source label.
- [Chinese Home, 320px](home-zh-320.png): the same real content at a narrow phone width.
- [Chinese college-sports card](college-zh-390.png): the actual S. 4668 card from the reported screenshot.
- [Chinese Browse](browse-zh-390.png): translated featured headlines and shared language control.
- [English Home](home-en-390.png): switching back restores original English.
- [Spanish pending](pending-es-390.png): English remains readable while the durable queue prepares translations.
- [Spanish network error](error-es-390.png): the local API was intentionally stopped; Retry and Use English remain available. Restarting it and choosing Retry resumed the translation request.

Independent Astra review found an ambiguous legal translation of “Corrections,” which prompted a card-specific translation context and cache version. The regenerated title is “惩教：假释与释放前治疗.” A second review found a model-version length edge case; the worker now reapplies the database's 80-character limit after selecting the scoped prompt. Real Postgres tests cover both stale-worker rejection and that persistence boundary. Card prompt changes do not invalidate existing full-reader translations.

Workspace lint, typecheck, tests, and formatting passed. The dedicated card and queue tests passed all 13 tests against a fresh migrated local test database. Expo Doctor passed 21 checks and a production iOS bundle exported successfully with the canonical production API URL. The requested Claude design consultation was attempted but unavailable because its session quota was exhausted; existing interface conventions were retained. Native-speaker editorial review and physical-device installation were not performed.
