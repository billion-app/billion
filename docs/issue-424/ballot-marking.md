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

## Running renderer evidence

The committed screenshots show the actual Expo web renderer harness at 390×844,
with the same Albert Sans and Inria Serif fonts loaded by the app. Records are
synthetic and explicitly labeled. `single`, `multiple`, `ranked`, and `unknown`
cover the four presentation states. The `large-text` captures use 200% browser
zoom and scroll the component's content; they are web layout checks, not native
Dynamic Type or production mobile evidence. The temporary harness entry point
was restored to Expo Router before production export and final checks.
