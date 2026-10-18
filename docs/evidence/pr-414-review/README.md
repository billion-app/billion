# PR 414 review — 2026-10-18

These screenshots show the running Expo app in production JS mode at 390 × 844 and 320 × 844 (Spanish). The guide is static California guidance; all personalized lookup data is intercepted synthetic data with explicitly fictional election, address, source and location names. Nothing here establishes live ballot coverage, official hours or a real deadline. No live voter lookup or production database write was used.

The guide now names California, links directly to official registration, locations, instructions and same-day registration tools, and provides Vote.gov for other states. Published voting guidance reuses the existing election-date-checked reader. Individual locations retain their supplied source citations. English, Spanish and Simplified Chinese copy follows the app language; official text and names remain as supplied.

The error capture and `lookup-error-edit.png` verify recovery from a failed address lookup. `production-closed-gate.png` was captured with the production JS mode and a disabled server launch response; the capture asserted that no voter-info request occurred. The static guide remained reachable in that mode. Reproduce the intercepted flows with
[verify-ui.cjs](verify-ui.cjs) from the repository root against Expo web
`--no-dev --port 8245`; use `GATE=closed ONLY_STATE=lookup-evidence` for the
closed-gate assertion. The script blocks non-local external requests.

## Review and regressions

Independent Astra review first assessed screenshot comprehension, then code and connected callers. Its findings on guide scope, promises, source loss and localization were fixed. Re-review found no remaining actionable issue in the unique How to Vote changes. The partial-location-window regression test fails against the prior implementation and passes after the fix: an undated location prevents asserting that the entire method is closed or not open yet.

Claude was asked for UI design review through the Claude Code plugin, but the request failed because the account had reached its session limit. That review was not completed.

## Final integration and checks

Integrated main `1636c0b3` and the reviewed #494 branch through `4c426cad`.
Shared location fixes preserve manual confirmation, cancel stale location
results and prevent delayed storage reads from undoing newer address changes.
The lookup explicitly disables enrichment. Astra re-reviewed the merge and
found no actionable regression.

Workspace `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`, and
`pnpm lint:ws` passed. The existing Next.js image warning remains. Final Expo
tests report 337 passed and one existing artifact-dependent skip. The separate
five tab-visibility tests passed. iOS and Android production exports passed
using an isolated temporary Metro cache. Catalog tests also passed after the
final error-copy corrections. Production browser fixtures exercised error →
Edit, source display, sparse data, all three languages, and closed-gate behavior.

The guide's scope and links were checked against the California Secretary of
State's [voting instructions](https://www.sos.ca.gov/elections/where-and-how),
[location finder](https://www.sos.ca.gov/elections/polling-place), and
[same-day registration](https://www.sos.ca.gov/elections/voter-registration/same-day-reg).
No numeric deadline is copied into the static guide.

## Limits

Browser fixtures do not verify provider access or live election data. Physical-device GPS, native keyboard, VoiceOver/TalkBack and large accessibility text remain unverified here. The native-location change requires a new binary. The inherited privacy-disclosure review in `docs/legal/data-inventory.md` remains a release blocker. No merge, deployment, release or production write was performed.
