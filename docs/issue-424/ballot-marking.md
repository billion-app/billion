# Contest ballot marking implementation gate

Contest detail now renders an explicit unknown state and election-office routing.
No live contest has reviewed instructions yet. Seat counts, candidate count,
party, office title, and election stage must never supply marking rules.

`apps/expo/src/components/ballot-marking/model.ts` owns the isolated contract.
`ContestMarking.tsx` renders source-attributed rules only when the contest ID,
election date, and jurisdiction match exactly. Production currently supplies no
instructions. A future API adapter must supply reviewed records through tRPC;
do not accept instruction claims in navigation parameters. The current unknown
hook passes an empty contest ID so it cannot match a reviewed record. Integration
must use a stable provider contest ID rather than a district ID.

Each reviewed record requires an official HTTPS source, authority, review date,
voting system, selection/rank limit, marking instructions, and an explicitly
instructional text example. Write-ins, overvotes, blank contests, and election
stages are optional sourced passages; omission makes no claim. Election stages
appear separately from marking. There are no selectable candidates or vote
submission controls in this component.

## Official research entry points (checked October 2, 2026)

- [California counting standards](https://www.sos.ca.gov/administration/regulations/current-regulations/elections/uniform-vote-counting-standards) distinguish overvotes from other marking issues. Counting standards alone do not establish an individual contest’s ballot layout or selection limit.
- [San Francisco official ranked-choice practice ballot](https://sfelections.org/tools/demo_rcv/) provides jurisdiction-specific instruction examples. It does not establish the mechanics of every California race or any other jurisdiction.

These sources are research references, not reviewed records attached to a live
2026 contest. Production display requires the official sample ballot for that
specific election and contest, human review of the summary and example, and
provider ID mapping coordinated with #418. Required runtime checks: single,
multiple, ranked, unknown, failed link, and enlarged text in the production mobile
flow. Fixture tests and automated review do not satisfy editorial or reader
comprehension validation. Keep the PR draft until these gates are resolved.

## Reading structure and examples

The count is the editorial headline, followed by the official marking action.
Optional write-in, overvote, and blank-contest passages have plainly named
expansion controls. “Sources & details” opens the source identity, direct official
link, system, election stage, and review date.
Essential marking restrictions must stay in the primary `marking` passage, not
be hidden in supporting detail. The voting boundary stays visible throughout.

A reviewed record may include `exampleDiagram` with oval targets, named columns,
and rows of reviewed marks. These are never inferred from candidate names or seat
counts. `example` must be the human-reviewed accessible equivalent of the diagram.
Unsupported target types or invalid positions retain the textual example. At high
font scaling or narrow multi-column layouts, the renderer uses that same reviewed
text rather than crowding the illustration. Official layouts and equivalence need
editorial review before a live record can be displayed.

## Final integrated runtime evidence

The committed screenshots show the actual running Expo web `contest-detail`
route at 390×844, with the app’s normal root, fonts, header, and candidate rows.
All records are synthetic and explicitly labeled. A temporary local capture patch
supplied the controlled instructions to the real component and bypassed onboarding;
that patch and Expo’s regenerated declaration were restored before final checks.
No fixture route or instruction query parameter ships in production.

`single`, `multiple`, `ranked`, and `unknown` show the integrated default states;
`example` and `sources` show real disclosure interactions. `link-error` uses a
controlled `Linking.openURL` rejection and shows the actual announced retry state.
The `large-*` captures use 200% browser zoom, including the narrow ranked example’s
text alternative and the reachable source action. They are web layout checks,
not native Dynamic Type or a production mobile accessibility pass. The existing
navigation title ellipsizes at this browser zoom; native navigation remains a gate.

The fresh screenshot-first Astra review initially rejected the dense equal-weight
instruction sheet. Iteration one established a dominant count and marking action,
optional examples, and a noninteractive diagram. Iteration two consolidated
sourcing and removed the default external button’s visual dominance. Astra then
independently found the local guidance impressive for its clarity and restraint,
with the answer available in seconds and optional explanation chosen by the reader.
The single-choice headline was further shortened to avoid making the simplest
mechanic visually heavier. This does not substitute for real-reader testing.

## Bills design alignment

The final marking card follows the current `BillBrief` summary language: slate
plane, 14px radius, subtle shared hairline, blue accent edge and compact document
icon, 17px editorial rule heading and 15px/23px body. Disclosure labels use the
compact 12px scale with 44px targets. Labels remain white for contrast; blue
chevrons distinguish interactive rows. No new palette or legislative semantics
were introduced. Source authority appears inside the source disclosure, preserving
space for candidate exploration.

`bills-reference` and `bills-brief` capture the actual `article-detail` route and
`BillBrief` renderer with explicitly synthetic content in the same confirmed Expo
process, dark theme and 390×844 viewport as the election captures. Port 8424 was
verified against the process cwd in this worktree. Capture waits for content and
browser fonts before taking images. Temporary article data, onboarding bypass,
contest fixture injection and link failure overrides are restored before checks.
The Bills images establish design comparison, not source-backed legislative data.

## Candidate-source integration

The pre-existing footer says “Source information unavailable.” The contest route
now labels that section “Candidate information sources,” so it cannot appear to
contradict the separate marking source. This narrow route addition leaves shared
provenance components unchanged; coordinate overlapping contest-detail edits with
#425 during integration. Long real contest and source names, native accessibility,
official-record mapping, editorial review and real-reader comprehension remain
unverified draft gates.
