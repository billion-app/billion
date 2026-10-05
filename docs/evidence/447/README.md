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

## Screenshot evidence

The actual Expo web app at port 8217 was rendered with Playwright. The API was
intercepted with the captured pending draft, intentionally bypassing publication
for the preview; banners label this. These screenshots are **source-backed draft
fixtures**, not proof of live published content. Enlarged web CSS text is not
native Dynamic Type. Missing and stale records share the same safe fallback.

- `40-collapsed-phone.png`, `42-collapsed-phone.png`: reciprocal readers.
- `40-expanded-cases.png`, `40-both-pass.png`: combined cases.
- `40-provisions.png`, `40-conditions.png`: scope and legal uncertainty.
- `42-enlarged-web-text.png`, `42-tablet.png`: enlarged text and larger viewport.
- `unavailable-stale.png`, `guide-error.png`: suppressed explanation and failure.

The capture script also exercises navigation to the other reader and checks for
browser page errors. It does not certify external source-link availability or
native accessibility. The GitHub screenshot comment records the exact reviewed
commit, so changes to the UI require refreshing that evidence.
