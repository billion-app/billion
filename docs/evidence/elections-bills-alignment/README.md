# Elections aligned with the Bills reader

Implemented in the integration branch after the 0.8.4 (40) build. These changes have not been built or submitted to TestFlight.

The reference is the running Bills reader for S. 1055, Indian Health Service Emergency Claims Parity Act. `bill-header.png` and `bill-brief.png` show its actual production content. All screenshots use the same verified integration Metro server, dark theme, 390 × 844 CSS-pixel viewport and 2× image scale, except `candidate-narrow.png` (320 × 700).

The entry, statewide guide, candidate detail, private preparation and voting plan now share the Bills reader's navy canvas, slate cards, hairline borders, 14-pixel card radius, editorial section headings, body scale, blue action text and blue selected segments. Guide cards expose readable identities without inflated portraits or repeated labels. Closed propositions reveal detail navigation after their summary expands. Candidate-authored statements remain distinct from official responsibilities and unpublished independent analysis.

## Evidence

- `entry.png`, `guide.png`, `measures.png`: integrated Elections entry and the real California guide.
- `candidate.png`, `candidate-duties.png`, `candidate-narrow.png`: real Fiona Ma statement and official office responsibilities, including narrow layout.
- `notes.png`, `note-editor.png`: real-guide local notes and settled editor.
- `plan.png`, `plan-mail.png`: directly opened voting plan and selected mail method.
- `candidate-error.png`: deliberately aborted API request to verify legible retry controls. This is an error-state test, not a production outage.

The guide comes from the production `civic.getCaliforniaGuide` endpoint: November 3, 2026, 13 statement submitters and 14 measures. It remains explicitly incomplete for local races and the full candidate roster. Independent briefs and other unpublished analyses retain their publication/development gates; no fictitious content replaces live data.

## Review and verification

Fresh independent Astra review compared the rendered Bills reference against all integrated screenshots before reviewing the diff. It requested a legible retry label, a settled note editor with save/reopen proof, and more compact closed proposition cards. All were corrected and reviewed again; the final verdict approved the scoped design/code changes with no blocking findings. Review does not certify source accuracy or native software-keyboard behavior.

Workspace lint, typecheck, tests and formatting passed during the change; Expo tests passed 230/230. Final affected-package typecheck, workspace lint/format and production iOS export were repeated after the final review fixes. Browser interaction verified a private note saves and reopens. Screenshots verify rendered web layouts; the production bundle verifies iOS compilation, not a native runtime or TestFlight installation.

Existing integration provenance and reachability are recorded in [the original integration evidence](../elections-integration/README.md). All twelve revised source PR heads are now integrated and recorded in `../elections-integration/source-prs.json`; each recorded commit is an ancestor of this integration. The final combined review restored the guide-only notes heading and roster guard after the incoming private-preparation changes, and changed the process page’s cream controls to Bills-aligned blue/slate. Source-specific role, brief, comparison, consequence, accessibility, marking and accountability refinements are included. `process.png`, `accessibility.png` and `proposition.png` show their reachable education/resources/official-guide routes. Development-only analyses remain gated. Final combined workspace checks and production iOS export were repeated after these fixes.

## Accessible action labels

The final targeted contrast followup uses existing light text for normal-size source/action labels on slate and nested surface cards. Blue remains on icons and selected controls; blue text remains on the navy canvas where it passes. The audit also corrected address Edit, unselected process examples and Hide plan. Independent Astra verified the sRGB ratios: white/slate 13.754:1, white/surface 11.700:1, blue/navy 4.808:1. Blue icons on slate/surface pass the 3:1 graphical-control threshold (3.680:1 and 3.130:1). Copying the older Bills blue-on-slate normal-text treatment would fail 4.5:1, so these actions use the existing light label token instead.

The followup also improves reader-relevant source, coverage, privacy and status captions within the election screens and components. A local 70% white text treatment preserves their muted hierarchy without changing the shared palette or Bills. Its independently computed contrast is 9.155:1 on navy, 7.555:1 on slate, 6.657:1 on surface and 5.808:1 on the higher plane. Meaningful note/address/search input prompts use the same treatment. Disabled controls remain visibly disabled. Native software-keyboard behavior remains unverified.
