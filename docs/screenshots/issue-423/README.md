# Comparison prototype evidence

Captured October 2, 2026 from the actual Expo web application at a 390 × 844 viewport. All candidates, elections, statements and records are synthetic; no live ballot, generation or database write was used. The browser session has a local completed-onboarding fixture.

- `multi.png`: initial three-candidate screen and the topic control.
- `multi-cards.png`: candidate rows, distinct priorities and withdrawn status.
- `source-open.png`: attributed claim and inspectable, explicitly labeled fictional source excerpt.
- `two-source.png`: two-candidate race with an opened source.
- `sparse.png`: missing evidence, including a withdrawn candidate.
- `analysis-unavailable.png`: reviewed analysis explicitly unavailable, without substituting promises for effects.
- `questionnaire.png`: explicit questionnaire non-response, separate from evidence gaps.
- `long-roster.png`: end of the eight-candidate roster; all eight identities are also checked in model tests and the browser accessibility tree.
- `browser-200-percent.png`: actual browser CSS zoom at 200%, showing topic labels reflowing to one column. This does **not** verify native Dynamic Type or a screen reader.
- `production-gate.png`: production web export served locally; the route renders only its unpublished notice, without fictional claims or controls.

Independent Astra review identified crowded topics, excessive introductory copy, unclear source excerpt hierarchy and dim links. Those were fixed. Its re-review identified overlap at 200% zoom; opt-in wrapping in the existing segmented control fixed it. Final re-review found no remaining actionable defect within the prototype scope and confirmed comprehension of the sourced priority difference and evidence gaps.

Editorial approval, reviewed live evidence through tRPC, native Dynamic Type/VoiceOver/TalkBack, human comprehension testing, and the production mobile ballot flow remain publication gates. Browser screenshots and automated review do not substitute for them.
