# Election process prototype (#419)

This hand-authored, source-linked education route teaches nomination versus election using three explicitly labeled examples. It is independent of ballot-provider access and candidate analysis. The single Elections invitation links to `/election-process`; #418 can preserve that hook when replacing the entry screen.

It deliberately has no candidate roster, current contest stage or scheduled milestone. A production contextual flow requires a dated authority record identifying office, district/jurisdiction, election year and kind, verified stage, next official milestone, applicable party rules and source URL. Unknown values must remain unknown. Registration and party affiliation cannot be inferred from an address. The #396 watchlist remains research-only; filing and declaration cannot establish ballot access or nomination.

Before publishing, editorial review must check summaries and authoritative links, especially special-election exceptions and Texas runoff rules. First-time voters must use each example and explain nomination versus election, describe the selected system and find their own next official action. Record comprehension failures and iterate; automated review does not satisfy this gate. Native production runtime, Dynamic Type and screen-reader verification remain required before declaring #419 complete.

The UI’s dated source-consultation line is not a freshness guarantee. A subsequent content edit must recheck the sources and update that line. No scraped text, AI generation, provider writes or registration assertions are involved.

## Implementation evidence

Screenshots were captured from the running Expo web development app at 390 × 844, using the hand-authored examples, on October 2, 2026. `president.png`, `california.png` and `texas.png` show entry/participation. `texas-path.png` shows nomination/runoff/election and the missing-stage state; `california-special.png` shows the expanded special-election exception. `unavailable-stage.png` shows official routing and provenance. These are browser render evidence, not native screenshots or Dynamic Type evidence.

Validation: workspace lint (one existing Next.js image warning), typecheck and format passed. Expo tests passed 184, skipped one; root OTA policy tests passed 12. Production iOS export passed. After review fixes, Expo typecheck, focused ESLint, edited-file Prettier and `git diff --check` passed. Workspace tests failed three unchanged scraper `content-images-arguments.test.ts` subprocess tests; all returned null exit status after the configured 15-second timeout. A focused rerun reproduced them. No scraper behavior was changed and this failure remains reported rather than dismissed.

Independent Astra reviewed screenshots before implementation, answered nomination versus election and next-action questions, then reviewed code and sources. Its two content findings were addressed: explain California's outright special-primary election exception and define Texas's majority/top-two runoff. Caption contrast was improved with shared `inkOnNight`; readable SOS runoff evidence replaces an Angular statute landing page. The reviewer also prompted the Texas general-election/runoff clarification and the narrow frontend guide update. Re-review outcome is recorded in the PR.
