# Comparison prototype evidence

Captured October 2, 2026 from the actual Expo web application at a 390 × 844 viewport. The comparison candidates, elections, statements and records are synthetic; no live ballot, generation or database write was used. The separate Bills reference captures show existing live API content, not comparison fixtures. The browser session has a local completed-onboarding fixture.

- `bills-reference-top.png`: actual article-detail header for H.R. 6213, fetched through the app’s normal API.
- `bills-reference-brief.png`: current BillBrief short-version and key-term cards, at the same 390 × 844 viewport and dark theme.
- `bills-reference-source.png`: current BillBrief change card and opened source disclosure.
- `multi.png`: initial three-candidate screen, shared question and both sourced priorities.
- `multi-cards.png`: candidate rows, distinct priorities and withdrawn status.
- `source-open.png`: attributed claim and inspectable, explicitly labeled fictional source excerpt with its name and locator.
- `two-source.png`: two-candidate race with an opened source.
- `sparse.png`: missing evidence, including a withdrawn candidate.
- `analysis-unavailable.png`: reviewed analysis explicitly unavailable, without substituting promises for effects.
- `questionnaire.png`: explicit questionnaire non-response, separate from evidence gaps.
- `long-roster.png`: end of the eight-candidate roster; all eight identities are also checked in model tests and the browser accessibility tree.
- `browser-200-percent.png`: actual browser CSS zoom at 200%, showing section labels reflowing to one column. This does **not** verify native Dynamic Type or a screen reader.
- `mixed-record.png`: one sourced budget vote alongside compact missing-evidence cards.
- `section-recovery.png`: empty-state action opens section choices where the reader is.
- `about.png`: publication and evidence explanations revealed on request.
- `visual-200-percent.png`: enlarged proposal pictogram, council-request row and source action, with text wrapping. Browser stress check only.
- `disclosure-200-percent.png`: About disclosure and adjacent text at 200% browser CSS zoom, verifying bounded text and chevrons.
- `production-gate.png`: production web export served locally; the route renders only its unpublished notice, without fictional claims or controls.

The initial independent Astra review resolved overflow and basic comprehension defects. A fresh, screenshot-first Astra design review then found the answer buried beneath process copy, weak comparison hierarchy, repeated empty-state caveats, jargon and visually dominant source links. The same fresh reviewer assessed each subsequent iteration. Its second review found the surface readable but not yet compelling. The third found it a compelling, polished presentation it would willingly read: the shared question and sourced answer headlines lead, provenance is quieter, and empty-state recovery is directly available.

The final code pass also caught a missing-question exception and an overbroad budget-vote headline. Both were fixed, the five focused tests passed, and the same reviewer verified the fixes and refreshed screenshots. This verdict covers the narrow synthetic web surface. It does not establish performance with complex real evidence or satisfy the release gates below. The PR screenshot comment pins the reviewed commit and build/data labels.

A subsequent visual iteration added matching outlined bus/roadworks pictograms, common council-request rows and document source actions. The same independent Astra reviewer found these reduced rereading and made the shared proposal mechanism visible. It flagged unequal icon weight; the solid road glyph was replaced with an outlined roadworks glyph. An enlarged-browser pass exposed long-headline overflow beside the pictogram; wrapping the pair with a text basis adjusted for native font scale fixed the demonstrated web case, and Astra re-reviewed the actual capture and diff. The visuals do not rate candidates or assert outcomes, and unknown positions receive no invented pictograms.

Editorial approval, reviewed live evidence through tRPC, native Dynamic Type/VoiceOver/TalkBack, human comprehension testing, and the production mobile ballot flow remain publication gates. Browser screenshots and automated review do not substitute for them.

The final brand-alignment iteration was compared directly with actual Bills screenshots by a fresh screenshot-first Astra reviewer. It uses BillBrief typography, slate/surface/ink planes, 14px card radii, hairlines, compact icons and quote disclosures; it adds no palette or legislative semantics. Section switching retains a chevron and 44px target, source locators stay visible, and identical supplied context is scoped to statements shown. Generic UI components were not changed in this iteration. Native, human and publication gates still apply.
