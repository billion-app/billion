# Structured promise brief

The promise brief now separates the proposal, decision-making authority, and
unresolved requirements into icon-led cards. Each card retains the reviewed text,
selective emphasis, and its own source action. An exact repeat of the candidate
promise is shown once, with both citation sets available from “Proposal sources.”
The in-depth analysis is unchanged.

These captures show the running Expo development build with the fictional transit
fixture. They are layout and interaction evidence, not live candidate research.

- [Promise and reading controls](01-promise.png), 390px.
- [Structured brief](02-brief.png), 390px.
- [Authority and unresolved requirements](03-brief-sources.png), 390px.
- [Authority source](04-sources.png), opened directly from “Who decides.”
- [Narrow brief](05-brief-320.png), 320px.
- [Enlarged native body and source action](06-large-text-ios.png), iOS 26.5
  Simulator with accessibility extra-extra-large text. This is a partial card;
  it does not verify every enlarged heading or screen position.

The [browser check](verify.cjs) verifies section headings, statement-specific
source selection, Done and focus restoration, in-depth navigation and reload,
and 320/390/768px layouts. [Results](verification.json): five passing check
groups, no application JavaScript errors. Run it with the Expo development server
on port 8444:

```sh
node docs/evidence/443-brief-structure/verify.cjs
```

Expo lint and typecheck passed. Expo tests passed with 236 passes and one optional
skip. The final iOS production bundle exported successfully. Native simulator
checks exercised authority and unresolved-source actions and Done with enlarged
text. This is not a physical-device VoiceOver or full Dynamic Type acceptance run.

An independent Astra reviewer assessed screenshots before the diff and correctly
identified the promise, the shared decision-making, and the missing requirements.
Review caught that consolidating citations into one numbered list obscured the
statement-to-source connection. Per-card source access resolves that finding;
re-review found no further actionable defects. The brief still requires scrolling
on small phones, and full enlarged-heading verification remains unrun.
