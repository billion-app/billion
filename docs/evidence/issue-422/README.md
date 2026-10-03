# Voting plan evidence

Actual running Expo web, 390 × 844, captured October 2, 2026. These are implemented
screens, not mockups. tRPC responses were intercepted with a synthetic California
guide containing 24 fictional candidate rows. The sparse ballot omits normalized
input; missing-guide and guide-error scenarios exercise the integrated parent
screen. No provider requests, database writes or generated content were used.

- `plan-collapsed.png`: compact entry in the populated statewide guide.
- `plan-overview.png`: registration action and method choice together.
- `plan-mail.png` and `plan-in-person.png`: selected preference and next action.
- `plan-mail-details.png`: distinct request, postmark and receipt explanations,
  plus the official tracking service.
- `plan-in-person-details.png`: location, hours and what-to-bring help.
- `plan-primary-help.png`: optional primary eligibility help, collapsed by default.
- `plan-about.png`: privacy, status limits and source disclosure.
- `plan-missing-data.png` and `plan-error.png`: official next actions remain useful.
- `plan-sparse-ballot.png`: actual How to Vote with one office fallback, without a
  repeated resource-only panel.
- `plan-specific-mail.png`: registration fallback remains alongside a separate
  supplied mail service.
- `plan-logistics-action.png` and `plan-logistics-destination.png`: integrated
  navigation to a fictional supplied location, address and hours; source is labeled
  an unconfirmed synthetic fixture. The settled heading is at y=55.5 below pinned
  navigation, including jump → return → reopen → jump without intermediate scroll.
- `plan-enlarged-method.png`: browser text enlarged to 160%. This does not verify
  native Dynamic Type or VoiceOver.

Browser interactions verified primary requirements are absent from the initial
plan, mail deadline distinctions appear on request, mail preference restores on
reload, a different election starts at Unsure, return restores the guide heading
and keyboard focus, and the sparse How to Vote returns focus to its ballot entry.
No page exceptions occurred in these sessions.

## Visual cues revision

The final visual revision uses blue task badges for registration and method choice,
plus labeled help/envelope/location icons in the existing selected control. A lock
pairs with the explicit device-only preference status. Mail guidance uses three
separate icon-led rows—request document, postmark clock, receipt destination—so
readers can distinguish the questions without reading a paragraph first. Icons
and color do not convey completion, eligibility, or verified registration. All
meaning has text equivalents; decorative glyphs are hidden from accessibility.

The actual integrated screenshots include these changes across selected, missing,
error and enlarged-text states. The fresh independent Astra visual-cues reviewer
found the next action clear, deadline distinctions comprehensible, and icon density
restrained. Its follow-up review confirmed that icons above method labels resolve
the cramped enlarged selector, with no remaining actionable screenshot or semantic
blocker. Exact commit confirmation is recorded in the PR screenshot comment. Existing native/live/reader/editorial gates apply.

## Design review iteration

The fresh rigorous screenshot-first Astra critique and the independent four-PR
audit both rejected the earlier multi-screen warning/link checklist. This revision
moves registration and method choice forward, makes primary help optional, presents
one method-specific next action, shortens separately attributed links, collapses
secondary rules/provenance, and removes duplicate sparse-state office panels.
It also makes the return interaction a labeled control with an arrow. Prior
no-overflow and correctness reviews did not establish willingness to read.
The same independent Astra reviewer iterated on these screens and accepts the
final design for its implemented scope, saying they would willingly use it. The
reviewer describes it as polished and restrained, and explicitly does **not**
consider synthetic screenshots evidence of an exceptional, fully proven voting
companion. The user's stronger “independently impressed” outcome remains unproven.
Resolved findings include irrelevant primary help, circular Unsure guidance,
misleading location labels, repeated office actions, disappearing registration
fallback, and a logistics jump that previously left its heading too low.

Independent Astra code review additionally found and resolved unconfirmed provider
websites promoted to office authority, a hidden mail-only notice, and retained
scroll offset after reopening. Regression coverage preserves the first two; browser
interaction verifies the third. Only the voting preference is saved on this device.

Native production flows, VoiceOver/Dynamic Type, live personalized logistics,
real-reader comprehension and editorial signoff remain unrun gates for #422.
