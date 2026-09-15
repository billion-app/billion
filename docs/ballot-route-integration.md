# Address-specific ballot lookup

The [`/ballot` route](../apps/expo/src/app/ballot.tsx) answers "What is on my ballot?" with races, candidates, measures, source evidence, and supplied voting information. Arnav owns the midterms explanation, general participation guidance, and Elections tab layout. Coordinate placement of shared voting information with that work.

## Public gate and lookup behavior

[`electionsAreLive()`](../apps/expo/src/utils/elections-live.ts) returns false. The public route checks it before mounting query hooks, so direct links show coming-soon content without requesting a ballot. The route is separate from the Elections tab. When lookup is enabled, its back action returns to the previous screen or home if opened directly.

`BallotExperience` accepts a manually entered voting address and stores it in component state. It does not put the address in route parameters or analytics events. [Local validation](../apps/expo/src/utils/ballot-lookup.ts) trims the input and requires 5–300 characters without control characters. This checks input shape, not residence or eligibility.

The first `civic.getVoterInfo` request sends the address with `includeEnrichment: false`. The returned `election` and `otherElections` populate the selector. Selecting another election sends its exact ID with the same address. Changing the address clears that selection. Discovery options remain available while another election loads; cached contests and logistics are hidden during loading, failure, or invalid input. A response for a different election is labeled with both requested and returned IDs.

The lookup retains contests for every state, including contests without candidates or enrichment. The view displays provider race names, candidate names and parties, and referendum text. Missing contests do not establish ballot publication status. California results mount only when the returned normalized state is California and an election is present. Official election-information links elsewhere come from the response; their presence does not establish that results have been published.

## Components and response contracts

[`BallotLookupView`](../apps/expo/src/components/ballot/BallotLookupView.tsx) receives the current response, discovery response, loading/failure/settled state, requested election ID, and callbacks for address submission, election selection, and retry. `BallotResponse` tolerates a missing election or normalized address. The optional `renderCaliforniaResults` callback lets fixtures replace the California feed without a network request.

| Component                                                                                           | Contract and behavior                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`BallotStatusNotice`](../apps/expo/src/components/ballot-evidence/BallotEvidence.tsx)              | Distinguishes invalid input, provider failure, an election without contests, and no data. Invalid-input retry focuses address editing; lookup retry refetches the read query.                                                                   |
| `BallotSources`                                                                                     | Retains field attribution and explicit official-source flags. A provider-linked referendum URL receives no inferred official status. Missing verification dates remain unknown.                                                                 |
| `BallotLanguages`                                                                                   | Receives no language evidence from this response and reports unknown availability. It does not infer that translated materials are unavailable.                                                                                                 |
| [`VotingLogisticsSection`](../apps/expo/src/components/voting-logistics/VotingLogisticsSection.tsx) | Receives the current response's location groups, `mailOnly`, and administration regions with `status="ready"`. It displays supplied details and office links without inferring deadlines. Non-ready states suppress data when reused elsewhere. |

See the [ballot evidence contracts](../apps/expo/src/components/ballot-evidence/README.md) and [voting logistics guide](voting-logistics-integration.md) for field attribution and reuse details.

## Local fixture and verification

[`BallotLookupFixture`](../apps/expo/src/components/ballot/BallotLookupFixture.tsx) renders the real view with fictional data and a no-network California results marker. To open it locally, create a temporary `apps/expo/src/app/ballot-preview.tsx`:

```tsx
export { BallotLookupFixture as default } from "~/components/ballot/BallotLookupFixture";
```

Use the [mobile setup](../CONTRIBUTING.md#run-the-mobile-app), complete onboarding if prompted, and open `/ballot-preview` under the existing Router providers. Keep the public lookup gate disabled. Remove the temporary route before committing or exporting production bundles.

Exercise the fixture controls:

- Select NC and its special election. Check the loading state and returned contest.
- Switch between CA, partial, empty, and noData. Check California-only results and the distinct missing-data messages.
- Select failed, then retry. Select loading to verify that its deliberately supplied stale response stays hidden.
- Select fallback to check the election-ID mismatch notice.
- Submit blank, over-300-character, and valid addresses. Check validation, editing focus, and recovery.
- Inspect source labels, supplied location details, narrow layouts, and large text on the target platform.

The fixture replaces request behavior. To test requests, mount the exported `BallotExperience` in a temporary test entry with an intercepted transport. Assert that discovery omits election ID, selection preserves the address and exact ID, both requests disable enrichment, address changes clear selection, and invalid input makes no request. Use fictional responses and remove the test entry afterward.

Run the applicable [package checks and production exports](../CONTRIBUTING.md#check-your-change). [Lookup tests](../apps/expo/src/utils/ballot-lookup.test.ts) cover state handling, missing fields, election alternatives, input bounds, and source URLs. Also check the public `/ballot` gate and custom TabBar in the production build.

Synthetic fixtures and bundle exports do not establish live provider coverage or installed-production behavior. Nationwide activation requires coverage evidence and release review; the public gate remains disabled.
