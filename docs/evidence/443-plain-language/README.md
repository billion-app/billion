# Plain language and shared definitions

The brief explains the intended change and its limits, who must agree, and what
is still unknown. It uses everyday language before offering definitions for
necessary terms. `DefinedText` is now shared by court briefs and candidate
research; meanings expand below their paragraph, with keyboard and native tap
support and a Close control. Statement-specific sources remain separate.

## Captures and data

- [Sample brief](02-brief.png) and [320px layout](05-brief-320.png): running Expo
  development app with a clearly labeled fictional bus promise.
- [Inline meaning](07-definition.png): keyboard-opened sample definition.
- [Native definition](08-definition-ios.png): installed iOS 26.5 development
  client, real native rendering of the fictional fixture.
- [Enlarged native definition](11-definition-large-ios.png): accessibility-large
  text, partial scroll position. This is not a full physical-device or VoiceOver
  acceptance run.
- [Real collected brief](09-real-brief.png) and [Congress definition](10-real-definition.png):
  real CA17 sources freshly collected into disposable local PostgreSQL, template
  `ca-house-17-v4`, collection `9ba4c5ac-1fb9-47b6-bb7f-3ebd768d7758`. Both certified
  candidates were collected without source errors. These are unpublished drafts,
  not approved candidate research. No shared database or production content changed.

The real screenshots use authenticated tRPC. The browser forwards a temporary
local test session to the local API because native auth headers are not sent by
cross-origin browser fetches. Responses are not mocked. The temporary session and
editor role were removed after verification.

Definitions were checked against the [House legislative-process guide](https://www.house.gov/the-house-explained/the-legislative-process),
[HHS Medicare/Medicaid explanation](https://www.hhs.gov/answers/medicare-and-medicaid/what-is-the-difference-between-medicare-medicaid/index.html),
and [CBO single-payer design report](https://www.cbo.gov/publication/55150).
These explain vocabulary; they do not establish a candidate's specific plan,
results or likely costs. Quotes retain the collected source text.

## Checks

Final workspace lint, typecheck, formatting and dependency lint passed. The root
test run had 781 passes and seven optional skips. The focused source/finance suite
had nine passes. The production iOS export passed. Lint retains the existing
Next.js image warning in `JourneyOverlay.tsx`.

The [fixture browser script](verify.cjs) checks Enter/Space, definition toggle,
Close/focus restoration, section-specific sources, depth/reload and
320/390/768px layouts. [Results](verification.json) contain six passing groups
and no application JavaScript errors. Run with Expo development on port 8444.
The [real-draft browser script](verify-real.cjs) requires the local test session
and API; [results](real-verification.json) verify both definitions, unchanged
source quotation and separate term/navigation controls.

Native checks exposed budget and transit board as separate accessibility buttons,
opened/closed their definitions, and checked normal and enlarged text. An actual
CourtBrief server render with the synthetic court fixture retained scoped stay
and preliminary-injunction definitions and temporary-ruling labels.

Parser tests cover whole words, longest terms, literal punctuation, exact
emphasis across term boundaries, empty vocabulary and unchanged text. An API
test checks that absent terms leave old revision digests unchanged, edited
meanings change the digest, and conflicting definitions are rejected.

Independent Astra review first assessed the screenshots without implementation
rationale. It understood the promise, limits, decision-makers and unknowns. Two
findings were fixed: body-sized definition links now use a contrast-safe text
color (7.19:1 on slate, 6.12:1 on nested surfaces); promise navigation is a separate
button so inline definition actions are not nested in a button. Real-reader
comprehension and physical-device VoiceOver remain release acceptance checks.

Re-review found no remaining actionable issues after those fixes.
