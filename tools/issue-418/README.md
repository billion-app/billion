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

The screenshots render the actual `BallotLookupGate` component through React Native
Web with Billion's real fonts and tokens, at 390×844. The gate props are controlled:
`closed.png` is verification pending; `error.png` is a failed availability check.
The browser retry action was exercised from error to closed. `large-text.png` uses
a 320px browser viewport and 150% enlarged text. It is a browser layout check,
**not native Dynamic Type or production runtime evidence**. No ballot/provider data
was requested for these screenshots.

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
