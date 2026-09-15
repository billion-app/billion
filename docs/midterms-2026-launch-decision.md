# Midterms 2026 launch decision

## September 14 decision: no-go pending evidence

This is the initial evidence record for [#337](https://github.com/billion-app/billion/issues/337), under [#356](https://github.com/billion-app/billion/issues/356). It records a technical no-go recommendation, not an agreed delivery date or approval to release. The coordinator must update it with sibling artifacts before PR creation and the release owner must review it again before enabling ballots.

- Decision owner: **@ThatXliner**, the current assignee for #337 and #329–#332. The user remains the decision owner and can perform or delegate release execution, production verification, and rollback. A backup operator is optional.
- Reviewed September 14, 2026 (America/Los_Angeles): live issue bodies and comments for #337, #356, and #329–#332; checkout `dba8c52fac07096be6a33d3ba5e45db92630063d`.
- Current source behavior: [electionsAreLive](../apps/expo/src/utils/elections-live.ts) returns `false`; the [Elections route](<../apps/expo/src/app/(tabs)/elections.tsx>) shows its coming-soon screen. The [router](<../apps/expo/src/app/(tabs)/_layout.tsx>) declares Elections and the [custom TabBar](../apps/expo/src/components/ui/TabBar.tsx) has its icon. Tab presence is not ballot readiness. Installed production behavior has not been inspected in this task.
- Approved new rollout scope: **none**. Keep the existing disabled ballot behavior. No nationwide or statewide completeness claim is supported by this review.
- September 15 remains conditional. All four gates below lack release evidence here, so the target is not supportable on the evidence currently available. Open issue status alone does not prove work is absent; neither code completion nor passing fixtures proves live coverage.

## Gates and evidence required

All gates must pass for an explicitly listed rollout scope. Use `pending`, `pass`, or `fail`; attach artifacts and their observation dates. Pending counts as no-go. Do not replace pending with pass from a sibling's summary alone: inspect its report, diff, or runtime evidence.

| Gate                                                                    | Owner       | September 14 status | Evidence needed to change the decision                                                                                                                                                                                                          |
| ----------------------------------------------------------------------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#332 coverage](https://github.com/billion-app/billion/issues/332)      | @ThatXliner | Pending             | Bounded live samples across roughly 15 states and multiple jurisdiction types, dated matrix, election IDs, field availability, provider errors, official comparisons, limitations, and explicit supported scope. Repeat weekly through rollout. |
| [#329 lookup](https://github.com/billion-app/billion/issues/329)        | @ThatXliner | Pending             | Integrated address-specific lookup and multiple-election selection, non-CA ballots, CA results isolation, and production mobile evidence. A dedicated route still needs an approved reachable entry point.                                      |
| [#330 source/status](https://github.com/billion-app/billion/issues/330) | @ThatXliner | Pending             | Integrated citations and generated-summary labels, distinct missing/enrichment/error states, verified language links or unknown availability, and official office or retry paths.                                                               |
| [#331 logistics](https://github.com/billion-app/billion/issues/331)     | @ThatXliner | Pending             | Integrated supplied polling/early-vote/drop-off details and official links, mail-only/partial/missing cases, and cited deadlines or link-out behavior.                                                                                          |
| Release operations                                                      | @ThatXliner | Pending             | Exact candidate commit, platform artifacts and runtime IDs, production API target, device checklist below, rollback candidate and rehearsal, and recorded owner decision.                                                                       |

### Inspected coverage evidence

Inspected #332 commit `cd2db6b652845f5dce2127aee2bc7fb561b71de2`: the [coverage report](../tools/issue-332/evidence/2026-09-15.md) and [endpoint probe](../tools/issue-332/evidence/2026-09-15-endpoint.json). These relative links resolve when the coverage branch is included in the integration stack.

The probe at `2026-09-15T00:18:48.190Z` (September 14, 17:18:48 America/Los_Angeles) returned HTTP 403 with `api_access_not_configured` from Google's `/civicinfo/v2/elections` endpoint. The report records `accessNotConfigured` from the first probe using the original checkout's configured Civic credential. This is an access-configuration blocker, not proof that the key is invalid or that the elections API has retired.

No address-level voter-info sampling followed. The 15-state matrix is an **unmeasured sample plan**; official ballot comparisons and measured supported scope remain pending. The #332 tooling/report artifact exists, but the coverage release gate remains pending and the no-go stands. Restore authorized endpoint access before running bounded address samples; no repeated blocked requests, new paid service, or production writes are required by this update. The controlled integration review below adds implementation evidence; final candidate and installed-production acceptance remain pending.

The coverage matrix must distinguish base ballots from optional enrichment. A sample cannot establish complete statewide coverage. Empty responses must not become “no election,” “no voting method,” or “not yet published.” Publication dates and status require an official source. Do not infer personal registration or mail-ballot tracking status from Civic data.

### September 14 integration review

The coordinator inspected the final route implementation at `c9dd08e49af966ba836e92bf2ca8dafbff28aac8` and independently exercised the combined Expo web fixture at phone width. The lookup task also exercised the real `BallotExperience` and tRPC client using intercepted, fictional responses. Discovery omitted the election ID, selection sent the exact ID with the same address, both requests disabled enrichment, address changes cleared selection, and invalid input sent no request. These are implementation and controlled-fixture checks, **not installed-production or live coverage acceptance**.

| Area                | Evidence now available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Still pending                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| #329 lookup         | [Route](../apps/expo/src/app/ballot.tsx) guards query mounting with the disabled launch flag and requests base-only data. [Lookup view](../apps/expo/src/components/ballot/BallotLookupView.tsx) hides data during loading, failure, and invalid input. Coordinator observed election switching to the correct special race after loading, failure/retry recovery, distinct no-data copy, invalid 301-character input hiding ballots, stale-data suppression, 390×844 layout, and `/ballot` coming-soon behavior. | Live address-specific ballots, installed mobile behavior, production navigation and CA results isolation.                         |
| #330 sources/status | Inspected source/status/language components wired into the lookup view. Coordinator observed supplied NC candidate and contest citations and distinct failure/no-data states in synthetic data. [Evidence guide](../apps/expo/src/components/ballot-evidence/README.md) records candidate/measure detail integration and unknown language/provenance limits.                                                                                                                                                      | Real source-link correctness, official language evidence where available, complete installed candidate/measure/ballot acceptance. |
| #331 logistics      | Inspected reusable logistics mounted with the current response; coordinator observed supplied NC locations and hours, with stale logistics hidden during invalid/loading states. [Logistics handoff](voting-logistics-integration.md) preserves Arnav's participation ownership.                                                                                                                                                                                                                                  | Final placement coordination and installed full/partial/mail-only/missing-location checks using sourced information.              |
| #335 read hardening | [Read-path guide](ballot-read-hardening.md) records base-only lookup support, separate cache modes, bounded requests, and fake-provider concurrency tests.                                                                                                                                                                                                                                                                                                                                                        | Real production capacity and provider availability; fake-provider timings are not a production service commitment.                |
| Workspace checks    | Coordinator reran full `pnpm typecheck`, `pnpm lint`, and `pnpm test` successfully with final route `c9dd08e` included in stack tip `6523084`. Changed-file Prettier passed. Full `pnpm format` flagged 11 unchanged files. The lookup task passed 100 Expo tests, five tab-visibility tests, and final iOS/Android production exports.                                                                                                                                                                           | Recheck subsequent code changes. No blanket formatting pass is claimed.                                                           |

The [route integration guide](ballot-route-integration.md) now records completed #330/#331 wiring and the remaining placement handoff to Arnav. Both temporary preview routes were removed before the final production exports and commit. The source's launch flag remains disabled. The coordinator confirmed the Elections tab, tab registration, custom TabBar, AddressAutocomplete, and launch flag are unchanged from the stack's base.

The #329–#331 release gates above remain pending because fixture verification cannot demonstrate actual ballots, official comparisons, or installed production behavior. #332's HTTP 403 blocker and unmeasured 15-state sample plan are unchanged. No-go remains the decision.

## Proposed dates and scope

| Date         | Meaning                                                                                                                                                                                                                                                           | Required decision                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| September 15 | Conditional original target, coinciding with [National Voter Registration Day](https://nationalvoterregistrationday.org/press-release-national-voter-registration-day-2026-campaign-kicks-off-with-celebration-of-250-years-of-a-democracy-worth-showing-up-for/) | No-go on current evidence; reconsider only if every gate is demonstrated.                                                                                                                                                                                                    |
| September 24 | Proposed next readiness review                                                                                                                                                                                                                                    | Owner reviews integrated artifacts, current coverage, jurisdiction dates, operator availability, and remaining gaps. No meeting or automation has been scheduled.                                                                                                            |
| September 28 | Proposed late-September fallback                                                                                                                                                                                                                                  | Release only the scope supported by the review. If gates remain pending or fail, record another explicit no-go, remaining gaps, and next review date; do not automatically slip into a launch.                                                                               |
| October      | User acquisition planning requirement from coordination                                                                                                                                                                                                           | A useful, verified experience must be available in time for October acquisition. Distribution owners must agree channels, scope, and timing; no campaign, spend, outreach, or conversion commitment is established here. Narrow or postpone claims if readiness is unproven. |
| October 20   | Proposed feature freeze                                                                                                                                                                                                                                           | Owner agreement pending. After freeze, prioritize correctness, accessibility, source/date corrections, reliability, and rollback fixes; record exceptions. Earlier served-jurisdiction dates take precedence.                                                                |

Specific fallback blockers are the confirmed Civic API access failure, unmeasured address coverage and unresolved scope, pending final-candidate #329–#331 checks, unverified production navigation and failure states, and no demonstrated rollback candidate. September 28 does not resolve these by itself.

### Jurisdiction calendar inputs

These official sources were checked September 14, 2026. They are planning examples, **not a declaration that California or Virginia is supported**. Before adding a jurisdiction, record its official calendar URL, election, relevant dates and method-specific qualifications, check date, and reviewer. Recheck before release and during the weekly coverage review; use an official link when facts remain unknown.

| Jurisdiction and election                          | Verified planning facts                                                                                                                                                                                                                                                                                                                                   | Consequence                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| California, November 3 general election            | [Secretary of State calendar](https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026/key-dates-deadlines): October 5 is the deadline to begin mailing registered voters' ballots and the start of early voting sites. October 19 is the regular registration deadline; conditional registration runs October 20–November 3. | October 20 is already after early voting begins and regular registration closes. Verify local locations and source details before acquisition begins. |
| Virginia, November 3 general and special elections | [Department of Elections calendar](https://www.elections.virginia.gov/casting-a-ballot/upcoming-elections.html): early in-person voting September 18–October 31; regular registration/update through October 23, with in-person provisional registration/voting afterward through Election Day.                                                           | A September 28 rollout would already follow the start of early voting. Verify registrar-specific locations and hours before including this scope.     |

These dates are not national deadlines. Do not extrapolate a mailing deadline or publication status from Election Day, a missing provider field, or another jurisdiction's calendar.

## Teammate boundary and integration handoff

The September 13 meeting assigned **HalwaHacker/Arnav** #272, Elections tab redesign, the midterms explanation and voter impact, and investigation/migration away from Google Civic/Places. The user's clarified boundary is:

- Arnav owns “what ARE the midterms?” and “how can you participate?”
- The user's national ballot work owns “what’s on MY ballot?”: actual address-specific races, candidates, and measures, with sources and honest coverage and missing-data explanations.
- #331 voting logistics remain reusable components. Hand off their contracts and source metadata to Arnav and coordinate placement wherever they overlap with participation; do not build a duplicate participation view into the ballot route.

This decision document does not change that ownership or promise Arnav's delivery. The dedicated route is an address-specific ballot lookup, not a midterms explainer or participation view.

Sibling modules may supply a dedicated ballot route, source/status UI, logistics UI, coverage tooling, and read-path hardening. The minimal integration handoff is to give Arnav the route/component contracts and tested entry point, have the coordinated release candidate connect it to the agreed navigation, and verify both Expo Router and custom TabBar in production. Do not independently change Elections, TabBar, AddressAutocomplete, provider migration, or #272 explanation content to satisfy this document. Keep `electionsAreLive` disabled until a separate reviewed release decision authorizes activation.

The Google sunset claim needs endpoint-specific verification. On September 14, Google's official references still document [electionQuery](https://developers.google.com/civic-information/docs/v2/elections/electionQuery) and [voterInfoQuery](https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery). Documentation presence does not prove a working credential, response, coverage, or future availability. Keep provider investigation with Arnav; require measured live evidence for the selected implementation.

## Repeatable verification checklist

Copy this checklist into each dated decision update. Record reviewer, candidate SHA, evidence links, and `pass/fail/pending` for every item. Fixture and production observations must be labeled separately. This is a manual checklist; it neither performs live requests nor schedules work.

### Before production verification

- [ ] Refresh #329–#332 and #356; inspect the actual sibling artifacts and list any unmet acceptance criteria.
- [ ] Attach the bounded #332 report with sample count, jurisdiction types, timestamp, election IDs, official comparisons, and supported scope. Record omissions and enrichment failures separately. Never store household addresses or credentials in this document.
- [ ] Check every proposed jurisdiction's official calendar, language evidence, and office links; record the reviewer and check date. Keep unsupported claims out of acquisition copy.
- [ ] Run applicable [Contributing checks](../CONTRIBUTING.md#check-your-change) and the production [release preflight](ios-release.md#release-preflight). Record commands, results, candidate SHA, export artifact, and platform. A successful bundle is only build evidence.
- [ ] Record public API host and confirm production provider configuration by presence only using the [launch guide](launch.md). Confirm that the selected lookup path is read-only before live probes: legacy query handlers may write caches or trigger paid enrichment. Unapproved writes/spend block that probe, not permission to bypass the gate.
- [ ] Record whether the owner or a delegate will execute release and rollback (backup optional); record the last known good API deployment and compatible mobile build/update IDs, runtime, and source SHA. Rehearse rollback in a non-production environment.

### Production mobile evidence

Run on the exact release candidate with production-mode navigation. Use controlled fixtures for induced failures, then bounded, authorized live read-only checks for supported scope. Record device/OS, build/update/runtime IDs, API deployment, timestamp, expected and observed result, and screenshots or logs without private addresses.

- [ ] CA and non-CA addresses show the selected election's base contests even without enrichment; CA-only results and local content stay in California.
- [ ] Changing address clears the old ballot; multiple-election responses preserve address-specific choice and `otherElections` handling. Returning to the route does not show a stale address's ballot.
- [ ] Data available, known election with unavailable ballot, no data found, invalid input, and provider error are distinct. Every missing-data state offers a valid official office link or retry path.
- [ ] Partial ballots remain usable. Missing enrichment does not hide contests. Candidate and measure views preserve citations and generated-explanation labels.
- [ ] Supplied polling, early-vote and drop-off details retain dates, hours, notes, and attribution. Mail-only and absent-location cases do not imply that a method is unavailable.
- [ ] Registration, absentee, ballot information, and translated-material links open the correct official page. Unknown language availability is labeled unknown; deadlines require cited authoritative evidence.
- [ ] The intended entry point is reachable through production Expo Router and custom TabBar behavior; direct routes, back navigation, and disabled-state behavior match the release scope.
- [ ] Verify the actual installed production artifact after any authorized release. Repeat a CA/non-CA smoke check, source-link check, and missing-data check; record results rather than treating upload or OTA publication as completion.

### Decision and follow-up

- [ ] Record `go` only when all required gates pass; otherwise record `no-go`, exact gaps, owner, and next proposed review date. List supported jurisdictions/elections and excluded capabilities explicitly.
- [ ] Record completion or deferral of optional #333–#335 and distribution #336/#338–#340 before closing #356. Evaluate the minimal #345 ranking-policy question separately. They cannot substitute for #329–#332.
- [ ] Repeat coverage weekly through rollout and recheck after provider, API, navigation, or source changes. Assign the next review date and responsible person; this checklist creates no automation.

## Rollback and stop conditions

Wrong-address/election ballots, cross-state results leakage, misleading deadlines or missing-data claims, broken official links, unhandled provider failures, or a production route that defeats the intended scope require stopping rollout and acquisition claims for the affected experience. The user remains responsible for the release decision and may execute rollback or delegate it. This document authorizes no production action.

Restore the last verified disabled ballot experience or last known good scoped candidate. `electionsAreLive()` is compiled code, not a remote kill switch: changing it in Git does not immediately disable installed clients. Use the existing [production OTA compatibility process](ios-release.md#production-ota-updates) for compatible JavaScript; a native mismatch requires a compatible release branch or new binary. Keep the native fingerprint guard intact. If the API change caused the incident, restore the recorded compatible API deployment and verify older installed clients too.

After rollback, verify the installed artifact, API target, entry point/direct routes, disabled or scoped behavior, and official fallback links; record build/update IDs, time, operator, and results. Account for clients that have not fetched an update. Keep the decision at no-go until corrected behavior and coverage are reverified. Rollback procedure is proposed; successful rehearsal and production verification remain pending.

## Decision update record

Append a dated entry after each review, retaining this initial no-go for history:

- Reviewed at / reviewer / release operator / optional backup:
- Candidate SHA / API deployment / mobile build and update / runtime:
- #332 report and observation date / supported scope / exclusions:
- #329 / #330 / #331 integrated evidence and remaining gaps:
- Production checks / rollback rehearsal evidence:
- Official calendar and language-source rechecks:
- Optional and distribution work completed or deferred:
- Decision and reason / owner acknowledgment:
- Next review / proposed target / freeze agreement status:
