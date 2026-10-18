# PR 414 review — 2026-10-18

These screenshots show the running Expo app at 390 × 844 and 320 × 844 (Spanish). The guide is static California guidance; all personalized lookup data is intercepted synthetic data with explicitly fictional election, address, source and location names. Nothing here establishes live ballot coverage, official hours or a real deadline. No live voter lookup or production database write was used.

The guide now names California, links directly to official registration, locations, instructions and same-day registration tools, and provides Vote.gov for other states. Published voting guidance reuses the existing election-date-checked reader. Individual locations retain their supplied source citations. English, Spanish and Simplified Chinese copy follows the app language; official text and names remain as supplied.

The error capture and `lookup-error-edit.png` verify recovery from a failed address lookup. `production-closed-gate.png` was captured with the production JS mode and a disabled server launch response; the capture asserted that no voter-info request occurred. The static guide remained reachable in that mode.

## Review and regressions

Independent Astra review first assessed screenshot comprehension, then code and connected callers. Its findings on guide scope, promises, source loss and localization were fixed. Re-review found no remaining actionable issue in the unique How to Vote changes. The partial-location-window regression test fails against the prior implementation and passes after the fix: an undated location prevents asserting that the entire method is closed or not open yet.

Claude was asked for UI design review through the Claude Code plugin, but the request failed because the account had reached its session limit. That review was not completed.

## Limits

Browser fixtures do not verify provider access or live election data. Physical-device GPS, native keyboard, VoiceOver/TalkBack and large accessibility text remain unverified here. The native-location change requires a new binary. The inherited privacy-disclosure review in `docs/legal/data-inventory.md` remains a release blocker. No merge, deployment, release or production write was performed.
