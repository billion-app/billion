# Cross-measure pilot (#447)

This is a source-captured editorial draft for California's November 3, 2026
Propositions 40 and 42. It is **not published or editorially approved**. The
[immutable input record](../../../packages/api/src/lib/measure-relationship-revisions/ca-2026-pilot.json)
keeps exact identities, guide hashes, full PDF extractions, official analysis
(including interaction image alt text), retrieval times, document-byte hashes,
claim citations and pending review. The linked PDFs contain neighboring measures;
locators and proposition headings identify the relevant portions.

The current guide verifies the cited example's election and numbers. Both LAO
analyses describe possible judicial conflict. The two conflict clauses differ:
42 §5 claims all provisions of another conflicting measure are void when 42 has
more affirmative votes; 40 §8 targets conflicting provisions of another measure.
The draft distinguishes these proposed clauses from a legal determination,
identifies overlapping tax provisions, leaves ties unresolved, and mentions the
additional 41 interaction without claiming to cover it.

## Implementation and gates

`measureRelationshipSchema` defines a reusable two-measure relationship record.
The renderer contains no proposition-number switches or outcome text.
`publishedMeasureRelationships` matches both guide identities and hashes,
requires legal text and official analysis for each measure, validates citations
and captured text hashes, checks freshly ingested document hashes, and binds
approval to the entire immutable draft. One record serves both readers.

The committed registry contains this pending revision. The normal guide response
therefore exposes no relationship explanation for it. Once a source-supported
revision passes #334 editorial review, approval records reviewer, time, findings,
revision and `relationshipEvidenceHash(draft)`. A reviewable registry update may
select an earlier approved revision for rollback; it still must match current
sources. There is no automatic generation, automatic approval or database
migration. The bounded official-guide scraper refreshes hashes only for approved
registry inputs (maximum 20 documents, 5 MB per document); failed reads omit the
hash and suppress the dependent relationship. Existing caches without hashes
also suppress relationships.

Remaining gates: editorial/legal review of each combined case and causal warrant,
reader comprehension testing, native phone/Dynamic Type verification, normal
scraper refresh after an approved record is committed, and live API verification.
No shared-database writes or paid ingestion were run. Keep #447 open.

## Reader design

The initial four-paragraph expansion was rejected as too much reading. The
revised core is a compact relationship summary with sourced semantic labels, an
explicit causal relationship sentence, four scenario controls and one consequence
that changes in place. It follows the actual Bills reader's compact slate surfaces,
editorial heading and short labeled comparisons. The controls are hypothetical
passage cases, not voting instructions or current results. Selection is local to
the component and never saves a vote preference.

Both defaults open as a scenario, with legal uncertainty beside the consequence.
Its optional Yes-total comparison reveals the three orderings and their different
limits. Provision scope, conditions and official records are supporting disclosures;
opening them does not reveal a stack of every unrelated scenario. Compact copy is
separate cited input under `compact`, not runtime truncation or generated summaries.
Publication requires it, validates its citation IDs and binds it to editorial
approval. Changing a node label or selected consequence invalidates prior approval.
An absent compact revision uses the unavailable fallback.

Scenario controls are ordinary buttons with pressed/selected state, supporting
standard keyboard activation without claiming tab semantics. Browser text enlargement
reflows the measure summaries by intrinsic width; native font scaling selects the
stacked layout. Native runtime behavior still needs verification.

The first Astra acted as designer after comparing actual Bills screenshots. A
separate fresh Astra then assessed screenshot comprehension without the implementation
rationale. The user rejection remains the reason this design was reopened; earlier
no-findings review was not treated as proof of a good reader experience. The fresh
review resolved enlarged-text wrapping, explicit conflict conditions, ambiguous
connector imagery, clause locations and repeated evidence prose. Its code review
caught incomplete tab semantics; ordinary pressed buttons now pass independent
Tab/Enter/Space checks. Six publication tests and focused package typechecks passed.
The final reviewed head and refreshed captures are recorded in the PR comment.

## Screenshot evidence

The actual Expo web app at port 8217 was rendered with Playwright. The API was
intercepted with the captured pending draft, intentionally bypassing publication
for the preview; banners label this. These screenshots are **source-backed draft
fixtures**, not proof of live published content. Enlarged web CSS text is not
native Dynamic Type. Missing and stale records share the same safe fallback.

- `40-collapsed-phone.png`, `42-collapsed-phone.png`: reciprocal readers.
- `40-neither.png`, `40-only-first.png`, `40-only-second.png`, `40-both-pass.png`: one selected consequence per hypothetical case.
- `40-vote-totals.png`: higher/lower/equal Yes-total conditions, not live results.
- `40-provisions.png`, `40-conditions.png`: scope and legal uncertainty.
- `42-enlarged-web-text.png`, `42-enlarged-web-outcome.png`, `42-tablet.png`: enlarged text, complete selected outcome and larger viewport.
- `unavailable-stale.png`, `guide-error.png`: suppressed explanation and failure.

The capture script verifies that only the selected consequence appears, selected state is exposed, Yes-total comparisons appear only for Both, evidence/provision disclosures work, navigation reaches the other reader, and checks for
browser page errors. It does not certify external source-link availability or
native accessibility. The GitHub screenshot comment records the exact reviewed
commit, so changes to the UI require refreshing that evidence.
