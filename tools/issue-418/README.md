# Personalized ballot release gate

Issue #418 owns the reader entry, not replacement provider ingestion. The Elections
entry and statewide guide now open the gated `/ballot` route. The route checks
`civic.getBallotAvailability` before mounting `BallotExperience`. An old API without
this procedure fails closed with an election-office fallback and retry.

The server contract is deliberately closed: no supported areas, no official ballot
comparisons and no running production mobile evidence are recorded. Configuring
`DEMOCRACY_WORKS_API_KEY` alone cannot open lookup. Raw server ballot procedures
remain available for authorized acceptance verification; this is a mobile launch
gate, not an authorization barrier around the underlying public provider API.

## Implementation evidence

The final screenshots run the full **production-mode Expo web export**, including
app layout, loaded Billion fonts, tabs, Expo Router and the real tRPC client.
They replace the earlier isolated gate-component captures. API responses are
controlled: guide null/error, a minimal guide-available entry fixture, and ballot
release availability false/error. They establish integration and UI behavior,
**not live guide/provider coverage or native production mobile acceptance**.

- `entry.png`: sparse-aware Elections entry, offering the real official California
  guide instead of advertising an unavailable in-app preview.
- `entry-with-guide.png`: preview-available entry (synthetic date/empty collections).
- `entry-loading.png`: pending preview; no active CTA changes its destination while
  the reader is about to tap it.
- `guide-sparse.png` / `guide-error.png`: missing/failed preview retains the official
  statewide guide, county-office help and a working Back action. Errors hide stale
  preview data.
- `closed.png` / `error.png`: useful official-ballot fallback, retry only on failure.
- `large-text.png` / `entry-large.png` / `entry-loading-large.png`: actual app at
  320px with browser text enlarged 150%; no horizontal overflow. The official-guide
  nodes are enlarged after query settlement. `entry-large-bottom.png` verifies that
  scrolling reveals the full official-ballot action above the tab bar. This is not
  native Dynamic Type verification.

Playwright exercised entry → gate → Back to Elections, entry → sparse/failed guide,
failed tRPC availability → retry → closed recovery, and pending entry → official-guide
fallback. External destinations were blocked during captures; the official California
URL was separately verified at <https://voterguide.sos.ca.gov/> on October 2, 2026.

## Independent design iteration

A fresh `gpt-6-astra` reviewer viewed actual screenshots before code or rationale.
Its initial critique and the independent four-PR Astra audit identified technical
copy, redundant notices, retry for a known-closed feature, and an unavailable journey.
The second iteration addressed the deeper sparse-state issue with direct useful
source links, clearer hierarchy, readable spacing/contrast and unmistakable controls.
Astra was concretely impressed by the disciplined reduction and useful official
content destination within this pre-launch scope. Its reservation remains valid:
this fallback alone does not establish Billion's personalized election value.
Final polish addresses initial-loading CTA changes, wording precision and repeated
headings. An expert design verdict does not replace real-reader/native/live gates.

## Meaningful visual cues

The entry replaces its decorative rule with a book beside the statewide-guide
label and pairs the official-ballot action with a location pin. These distinguish
reading statewide material from finding information tied to where the reader votes;
they do not establish address matching or coverage. Existing blue/cream accents
reinforce the labels without representing candidate quality or partisan judgment.

The fallback replaces its opening status sentence with a compact info-icon status
row (a spinner while checking). Status text remains explicit; color is not the only
signal. The body now explains only the useful election-office next step. Decorative
scope/status icons are hidden from assistive technology; visible text and button
labels retain the meaning. No maps, ballot checkmarks or certification seals imply
unsupported readiness.

## Remaining launch gates

- #399: configure licensed REST v2 `/elections` access with `includeBallotData=true`.
- #332: bounded live comparisons with official ballot records in each intended
  launch area, recording election selection, federal/state/local races and measures,
  missing fields and source citations. No supported areas are claimed here.
- #418: run the production mobile experience for supported and unsupported addresses,
  multiple elections, partial/empty data, failures and recovery; confirm lookup edits
  leave the saved home address unchanged. Include native large text and assistive
  technology verification.
- Record reviewed scope and both evidence sets in `packages/api/src/lib/ballot-launch.ts`
  before enabling production entry. The existing provider response remains partial;
  address-matching evidence must not be inferred from provider success.

This PR is a gated implementation and does not close the production acceptance
criteria or authorize a release. Existing PR #414's How to Vote work is preserved.
