# Ballot evidence components (#330)

These standalone components expose the limits of a lookup without deciding whether an election exists or a ballot has been published. They make no requests and do not enable Elections. Import from `./BallotEvidence` and `./model` in this directory.

## Integration handoff for #329

Render `BallotStatusNotice` after a lookup settles. Map validated input failures to `invalid-input`, upstream errors to `provider-failure`, and successful responses to `result` with the returned contest count and an explicitly known election. Do not turn pending queries, errors, mock data, or unrelated elections into an empty successful result. Keep existing results visible on enrichment failure. `onRetry` is required; for invalid input it must reopen address editing. Pass an official office URL only from a trusted source, never a generated URL.

Render `BallotSources` alongside ballot, candidate, or measure fields. Use `source` for original text, `ai-summary` for generated explanation, and `enrichment-unavailable` when the additional explanation is absent. This last state is independent of ballot status. Pass existing per-field citations without collapsing their field attribution. `MeasureCitationRef` is structurally compatible; candidate citation adapters must retain field, source name, URL and any explicit official-source evidence. Missing official flags remain unlabeled. Retry must refetch the relevant read query, not start paid generation.

Render `BallotLanguages` with sourced language/material evidence from #298 when available; pass an empty list today if none exists. Verification requires an official link, `verifiedAt` and `verifiedBy`. Other availability stays unknown even when some languages are verified. Missing API language fields never mean no translation. These components do not translate source text or UI strings.

The optional citation dates follow the proposed #299 names. `fetchedAt` is rendered as retrieval only. No verification timestamp is synthesized. #299 still owns shared provenance types and agreed freshness budgets; this module does not claim freshness or enforce a guessed budget. Replace this structural interface with that shared type when it lands.

## Scope and remaining wiring

No route or candidate/measure detail view is modified, per coordination ownership. #329 must consume these components, and detail views need the same field-level placements. #332 owns coverage observations; map those observations to these states only with evidence. Nationwide coverage, registration deadlines, publication status, #298 ingestion, and #299 freshness policy are not implemented here.

Focused verification follows [Contributing](../../../../../CONTRIBUTING.md#check-your-change). `model.test.ts` exercises the evidence boundaries and URL handling without providers or database writes.
