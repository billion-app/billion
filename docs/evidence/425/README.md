# Issue 425 runtime evidence

Captured from this worktree's running Expo web development bundle at
390 × 844 CSS pixels on the dark navy canvas. All people, statements, addresses,
contests and legislation are synthetic. These images do not establish provider
coverage or production mobile behavior.

## Bills comparison

[Bill identity and summary](bills-header.png) and [BillBrief cards](bills-brief.png)
render the actual `article-detail` route and current `BillBrief` with an
intercepted, explicitly labeled synthetic bill response. Election screens and the
Bills reference were captured on the same confirmed server: port 8207, working
directory `apps/expo` in this worktree (process 82333, then 93256 for the final
guide-only recapture, and 94613 for the final lookup label). No other thread's server
was used. That capture process was stopped after verification.

The election adaptation shares Bills' editorial headings, body-text scale,
slate planes, 14px card radii, fine borders and compact disclosure/actions.
Candidate statements remain attributed source material; election status does not
borrow legislative outcomes or partisan colors. Compact underlined link labels
retain high contrast on slate, paired with blue action icons. Filled recovery
actions use dark ink on the existing blue token.

## Finished screens

- [Race](race.png), [sparse race](sparse.png), [withdrawn candidate](withdrawn.png)
  and [sparse candidate](candidate-sparse.png) show compact election context,
  explicit status, honest limits and useful election-office actions.
- [Candidate with statement](candidate-populated.png) shows a complete short
  supplied statement. [Long excerpt](statement-excerpt.png),
  [expanded statement](statement-expanded.png), [bottom](statement-bottom.png)
  and [collapsed again](statement-collapsed.png) show unchanged source text and a
  working expansion/scroll/collapse round trip.
- [Source disclosure](candidate-sources.png) keeps provider retrieval separate
  from unavailable human review without dominating the initial screen.
- [Lookup](lookup.png), [journey race](journey-race.png) and
  [journey candidate](journey-candidate.png) follow actual clicks through the
  existing `BallotLookupFixture`. Fictional-data labels remain visible.
- [Provider error](provider-error.png), [election mismatch](mismatch.png),
  [guide error](guide-error.png) and [guide null](guide-null.png) retain recovery
  actions. Guide responses are intercepted tRPC error/null fixtures.

## Independent review and limits

A fresh gpt-6-astra design reviewer compared Bills and election screenshots
before seeing code. It found the compact card/type adaptation consistent with
Bills and clear for scanning. Its actionable feedback covered link affordance,
counting withdrawn entries and the inconsistent paper fallback action. Revised
screens use recognizable links, count names shown and races rather than conflating race/candidate counts, and use compact source-style
actions. A separate fresh Astra code review identified two small-text contrast
regressions; both were corrected and re-reviewed. Labels/source links now exceed
12:1 on slate, filled primary text/icon achieves 4.92:1, and blue action icons
exceed 3:1. Static review does not establish native accessibility execution.

[Web enlargement diagnostic](web-enlargement-diagnostic.png) injects 1.8× text and
line-height. Fixed-header clipping remains a diagnostic limit; this is **not**
native Dynamic Type proof or an accessibility pass. Capture-only routes were
removed before commit. Existing Expo-web authentication CORS remains outside
this change. No database writes or ingestion occurred.

Live provider and freshness/human-review producers, native large text and screen
readers, production mobile flow, real coverage, editorial approval and
unfamiliar-reader comprehension remain separate gates. The PR stays draft.
