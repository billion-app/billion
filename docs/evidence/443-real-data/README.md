# Real collected candidate research — local verification

Captured October 5, 2026 UTC from the running implementation on branch `codex/candidate-research`. These are real collected CA-17 source drafts, not the fictional Morgan Lee prototype and not editorially approved research. No real candidate revision or publication policy was approved during this work.

| Capture                                    | What it verifies                                                   |
| ------------------------------------------ | ------------------------------------------------------------------ |
| [Certified roster](01-roster.png)          | Both candidates; stable official IDs and readable election context |
| [Candidate brief](02-brief.png)            | Candidate-attributed promise and explicit unreviewed history       |
| [Promise in brief](03-promise.png)         | Proposal, missing funding/timetable details and office authority   |
| [In-depth analysis](04-analysis.png)       | Stated aim and funding/implementation uncertainty together         |
| [Source sheet](05-evidence.png)            | Directly retrieved candidate quotation distinct from explanation   |
| [Campaign money](06-money.png)             | Reconciled FEC totals; refunds and outside spending separate       |
| [Editorial workbench](07-workbench.png)    | Authenticated source inspection, corrections and review controls   |
| [Unauthorized draft](08-access-denied.png) | Draft content unavailable without an authorized editor session     |

Reader captures use the Expo web implementation at 393×852. Workbench is Next.js at 1280px. Playwright used a disposable local editor session; the Expo browser harness forwarded that cookie to the real local tRPC endpoint because native Cookie-header transport does not work unchanged in a cross-origin browser. It did not mock API results. The workbench used an ordinary same-origin session cookie. This verifies collected source → database → authenticated API → rendered draft; it does not claim a physical-device login or VoiceOver acceptance test. The iOS production bundle exported successfully. Earlier native fixture checks remain in [443-native](../443-native/README.md).

## Live collection

The final run collected both certified California Congressional District 17 candidates for November 3, 2026 into disposable PostgreSQL on localhost:55443. The final collection ID was `4eb7251e-3dd6-4318-9025-32b50072eca5`, template `ca-house-17-v3`. Exact quotes, source URLs and hashes are retained in the protected collection; source and finance validation passed with no collection problems.

Sources were the California Secretary of State certified roster, machine IDs and contact list, the candidates' directly accessible position pages, US House legislative-process guidance, and public FEC candidate financial summaries. OpenFEC's demo key hit its rate limit. The implemented fallback fetched the actual FEC summary pages; it did not invent itemized contributions or outside spending. Those gaps remain explicit in the app.

The FEC summaries covered January 1, 2025 through June 30, 2026: Khanna's receipts $13,761,490.91 and refunds $281,878.41; Tandon's receipts $37,653.48 and refunds $200.00. Both receipt breakdowns reconciled. This is a bounded pilot with selected positions; comprehensive voting histories and donor-interest classifications are not established by it.

## Verification

- Source parser and provenance tests: 9 passed, including memo exclusion, conflicting duplicates, profile reconciliation, identity mismatch, missing source fields, API-versus-PDF provenance, and missing-platform drafts.
- Authenticated publication lifecycle against disposable Postgres: 11 checks passed. Covers denied access, forged sources, publisher permissions, independent approval, stable release links on unchanged refresh, concurrent refresh failure, withdrawal/recovery, self-approval rejection and superseded drafts.
- Full API suite with that database: 111 passed, 3 unrelated optional skips.
- Policy resolver test verifies the policy and release use one repeatable-read transaction.
- Browser checks: roster, candidate, money, promise brief/depth, source sheet open/Done, protected workbench and unauthorized draft state; no application JavaScript errors in successful captures.
- Full repository tests: 777 passed, 7 optional skips. Repository lint/typecheck/format and workspace dependency checks passed. One pre-existing Next.js image warning remains in `JourneyOverlay.tsx`.
- iOS production export passed. No shared database migration, deployment, TestFlight release or real editorial approval occurred.

An independent Astra code review found and verified fixes for concurrent-failure checks, stable renewal URLs, policy snapshot consistency, visible coverage limits, API/PDF provenance and missing-platform handling. A separate Astra screenshot review confirmed the goal/result distinction, explicit authority/funding limits in the short view, usable source actions and no remaining blocking comprehension/layout defect. This is not a substitute for human editorial approval or physical-device accessibility acceptance.

See [collection operations](../../candidate-research-collection.md) for reproducible collection, review and database-test commands.
