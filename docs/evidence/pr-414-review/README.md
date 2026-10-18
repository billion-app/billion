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

Browser fixtures do not verify provider access or live election data. Physical-device GPS, native keyboard, VoiceOver/TalkBack and large accessibility text remain unverified here. The native-location change requires a new binary. The location disclosure assessment is recorded in `docs/legal/data-inventory.md`: iOS uses Apple’s OS geocoder, so device access alone does not add a Precise Location collection category; the confirmed address remains declared. App Store Connect answers were not inspected or edited. Before submitting the binary, publish the corrected website policy and check the existing store label against the inventory. No merge, deployment, release or production write was performed.

## Privacy and cleanup follow-up

The website and English, Spanish and Simplified Chinese app policy now describe the
optional foreground fix, platform geocoder, confirmed address, actual providers and
storage. Cache validity is explicitly distinguished from deletion: expired records can
remain stored, and there is no scheduled purge. iOS secure storage can survive reinstall;
the policy directs readers to clear saved addresses explicitly.

`privacy-*` screenshots show the summary, and `policy-*-section-4/6/7` show the full
policy in the same production JS runtime. Section 7 is captured separately in English.
The `website-privacy-*` screenshots show the actual Next.js development page at
1280 × 900 using local placeholder configuration. No live database or provider request
was needed. English policy sections were compared directly across the website and app.

The code pass removed the unused numbered checklist, English display fields superseded
by translations, unreachable availability count and its analytics property, and merged
identical location-method construction. Location failures are now returned to the request
owner and checked against its cancellation revision, so abandoned failures cannot surface
after manual edits. Six new tests cover current and late permission/service/GPS failures.
Independent Astra review found the cache retention wording issue; the correction is
included in this follow-up. Astra re-reviewed the corrected disclosure text and refreshed
screenshots and found no remaining actionable correctness or visual issues.

Focused hook/address/voting tests: 45 passed. Workspace typecheck and tests passed;
Expo reported 340 passed and one existing artifact-dependent skip. The full production
browser fixture suite passed again, including all three policy languages and the closed
lookup gate. Physical-device testing remains outside this verification.
