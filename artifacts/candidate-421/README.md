# Candidate brief UI evidence

Captured from the actual running Expo web development app on October 2, 2026,
with a 390×844 viewport. Alex Rivera and the school-board route data are synthetic
and contain no candidate statement, office duties or reviewed analysis. The
completed-onboarding browser state was set only to reach the candidate screen.
No live candidate data, provider calls or database writes were used for capture.

- `sparse-viewport.png`: sparse candidate screen and unpublished brief state.
- `sparse.png`: same running sparse screen.
- `large-text.png`: browser 150% zoom, scrolled to the independent brief disclaimer
  and election-office action. This is not native Dynamic Type verification.

Independent gpt-6-astra screenshot-first review found that the screen accurately
conveys missing priorities/record, unavailable independent analysis and the fact
that missing coverage says nothing about qualifications. Fixed findings: missing
statement copy incorrectly implying a supplied statement, and low-contrast small
text on the disclaimer card. Re-review found no clipping, overlap or outstanding
visual findings in these captures. Real-reader testing and native accessibility
remain required before live analysis rollout.

## Rigorous design iteration

The earlier screenshots above are historical baseline evidence. A fresh
independent Astra review and the root four-PR audit requested substantive design
changes: the sparse page was a wall of absence notices and the initial populated
redesign was a wall of closed boxes. The final additions are captured through the
actual candidate-detail route, not a separate renderer harness:

- `sparse-redesign.png`: consolidated coverage + immediate official action.
- `sparse-coverage.png`: optional publication explanation opened.
- `large-text-redesign.png`: sparse coverage/action at 150% browser zoom.
- `reviewed-redesign.png`: fictional populated brief with visible effects,
  attributed promises and record; source excerpts remain secondary.
- `reviewed-record-source.png`: documented fact with opened source excerpt,
  locator, retrieval date and original link.
- `mixed-redesign.png` and `mixed-record.png`: fictional brief with a missing
  record; the specific non-negative interpretation remains visible.
- `statement-redesign.png`: candidate-supplied statement without independent
  analysis. A short statement is fully visible, without a redundant expansion.
- `error-redesign.png`: intercepted tRPC guide failure, retry and official source
  recovery. No live API or database was called for this failure fixture.

Populated and mixed samples use development-only fictional fixtures with a
fictional candidate identity, records, sources and review-date example. They are
not published candidate analysis. The same consistent reviewer independently
called the second substantive iteration a “compelling, polished Billion reading
experience,” citing consequence + uncertainty first, flat attributed sections,
and source verification without crowding. Remaining refinements were addressed:
all claims now remain visible, short statements do not offer pointless expansion,
and retry is the primary recovery action. The final reviewed commit and
screenshot-first re-review are recorded in the PR's refreshed evidence comment.
Editorial, native accessibility and real-reader gates remain unrun.
