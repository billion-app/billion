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
- `reviewed-redesign.png`: fictional populated brief with attributed promises
  and record preceding mechanisms and effects; source excerpts remain secondary.
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

## Meaningful visual communication follow-up

The redesign captures were refreshed after a further screenshot-first Astra
review. Promise, fact, analysis and missing-information rows pair distinct icons
with explicit text. Blue identifies candidate promises and gold identifies
Billion interpretation; neither is a merit score. Priorities and documented
record precede interpretation. Source controls name the claim type they support.
Icons are hidden from assistive technology because adjacent text supplies their
meaning. No chart or decorative graphic was added to imply measured evidence.

Independent Astra re-review approved the final implementation with no material
visual reservations after flexible text constraints addressed the native-layout
risk beside icons. It judged the result polished and credible, with meaningful
comprehension gains, while noting that more elaborate graphics would add little.

## Bills brand-alignment iteration

The current redesign captures supersede the earlier iterations described above.
`bills-reference-top.png` and `bills-reference-brief.png` show the unchanged actual
article-detail and BillBrief renderers in the same Expo web app, dark theme and
390×844 viewport. The bill response was intercepted with an explicitly fictional
school-reporting proposal; it is renderer evidence, not live legislative data.

Candidate cards now use the Bills slate plane, 14-pixel radius, hairline border,
18-pixel section headings, 13.5/20 body typography and muted source rows. Source
excerpts use the ink plane and editorial italic face. Category accents remain
muted, with explicit attribution labels. Sparse official recovery uses the
shared paper plane. Candidate-local components changed; shared generic UI and
publication/provider/editorial gates did not change.

The Bills comparison review requested clearer source actions, stronger disclosure
contrast, a modest leading priority card, and restoration of the display face
for candidate names. These were addressed without combining claims into an
invented summary: the lead remains explicitly a candidate promise.

Fresh independent Astra screenshot-first comparison re-review found no remaining
material brand, scanning or action-visibility issues in these captures. It
explicitly compared candidate cards, lead hierarchy, source quotations/actions
and display typography with the Bills screenshots. This is not native
interaction or real-reader testing, nor coverage of unseen longer-content states.

Capture integrity: dedicated Metro port 8421 was verified with lsof/ps. Its
listener cwd was this worktree’s `apps/expo`, and its command was Expo web on 8421. Bills and candidate captures were then refreshed sequentially from that
same running process, viewport and theme. No shared localhost8099 capture was
used. Final screenshots are bound to the commit in the latest PR evidence comment.

A separate fresh Astra code review found no actionable correctness/regression
findings, including re-review of the lint cleanup. URL filtering/retry, explicit
claim attribution, visible gaps and production preview rejection remain intact.
Native accessibility/runtime and live-link interaction were not independently
tested. Package checks and production-export results are recorded in the PR.
