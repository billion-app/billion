# Address-specific ballot lookup

The [`/ballot` route](../apps/expo/src/app/ballot.tsx) answers "What is on my ballot?" with races, candidates, measures, source evidence, and supplied voting information. Arnav owns the midterms explanation, general participation guidance, and Elections tab layout. Coordinate placement of shared voting information with that work.

## Public gate and lookup behavior

[`electionsAreLive()`](../apps/expo/src/utils/elections-live.ts) returns false. The public route checks it before mounting query hooks, so direct links show coming-soon content without requesting a ballot. The route can also supply the Elections tab and local-election screen when those callers receive Democracy Works data. When lookup is enabled, its back action returns to the previous screen or home if opened directly.

`BallotExperience` accepts a manually entered voting address and stores it in component state. Its optional `initialAddress` seeds that state when an existing entry point already has a stored address; the caller keys the experience by that address so an external change resets its selection. Editing inside the national lookup remains local to that experience. It does not put the address in route parameters or analytics events. [Local validation](../apps/expo/src/utils/ballot-lookup.ts) trims the input and requires 5–300 characters without control characters. This checks input shape, not residence or eligibility.

The legacy callers detect the provider with enrichment disabled and route Democracy Works responses into this view instead of the California-only presentation. They no longer request an addressless election list. The local screen shows loading or retry while resolving the provider and gates representatives on a returned normalized California state.

The first `civic.getVoterInfo` request sends the address with `includeEnrichment: false`. The returned `election` and `otherElections` populate the selector. Selecting another election sends its exact ID with the same address. Changing the address clears that selection. Discovery options remain available while another election loads; cached contests and logistics are hidden during loading, failure, or invalid input. A response for a different election is labeled with both requested and returned IDs.

The lookup retains contests for every state, including contests without candidates or enrichment. The view displays provider race names, candidate names and parties, and referendum text. Missing contests do not establish ballot publication status. California results mount only when the returned normalized state is California and an election is present. Official election-information links elsewhere come from the response; their presence does not establish that results have been published.

## Components and response contracts

[`BallotLookupView`](../apps/expo/src/components/ballot/BallotLookupView.tsx) receives the current response, discovery response, loading/failure/settled state, requested election ID, and callbacks for address submission, election selection, and retry. `BallotResponse` tolerates a missing election or normalized address. The optional `renderCaliforniaResults` callback lets fixtures replace the California feed without a network request.

| Component                                                                                           | Contract and behavior                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`BallotStatusNotice`](../apps/expo/src/components/ballot-evidence/BallotEvidence.tsx)              | Distinguishes provider failure, an election without contests, and no data. Failure prioritizes retry; missing ballot data prioritizes an actionable election-office directory link. Address errors appear beside the input.                     |
| `BallotSources`                                                                                     | Retains field attribution and explicit official-source flags. A provider-linked referendum URL receives no inferred official status. Missing verification dates remain unknown.                                                                 |
| `BallotLanguages`                                                                                   | Receives no language evidence from this response and reports unknown availability. It does not infer that translated materials are unavailable.                                                                                                 |
| [`VotingLogisticsSection`](../apps/expo/src/components/voting-logistics/VotingLogisticsSection.tsx) | Receives the current response's location groups, `mailOnly`, and administration regions with `status="ready"`. It displays supplied details and office links without inferring deadlines. Non-ready states suppress data when reused elsewhere. |

The component props define field attribution and recovery actions. See the [voting logistics guide](voting-logistics-integration.md) for location fields and reuse.

## Reading and recovery

The address and election are compact context above the contests. Contest cards group candidate names or original measure text with their sources. A compact "How to vote" entry opens supplied voting resources above the contests. Language help expands below the ballot. Opening voting resources replaces the duplicate footer recovery link with the links inside that section. The input keeps validation beside the address and adjusts for the keyboard.

Provider coverage metadata remains visible: statewide-only results warn that local contests may be missing, and unknown address scope is labeled unconfirmed. A submitted address is not a verified or provider-normalized address. Democracy Works lookup links do not imply election-office authority; recovery uses the known election-office directory, while supplied destinations remain available as voting information links. Candidates explicitly marked withdrawn but still on the ballot retain that label beside their name. Missing polling-location arrays do not establish that no locations exist.

## Local fixture and verification

[`BallotLookupFixture`](../apps/expo/src/components/ballot/BallotLookupFixture.tsx) renders the real view with fictional data and a no-network California results marker. To open it locally, create a temporary `apps/expo/src/app/ballot-preview.tsx`:

```tsx
export { BallotLookupFixture as default } from "~/components/ballot/BallotLookupFixture";
```

Use the [mobile setup](../CONTRIBUTING.md#run-the-mobile-app), complete onboarding if prompted, and open `/ballot-preview` under the existing Router providers. Keep the public lookup gate disabled. Remove the temporary route before committing or exporting production bundles.

Exercise the fixture controls:

- Select NC, open "Change election", and choose its special election. Check the loading state and returned contest.
- Switch between CA, partial, empty, and noData. Check California-only results and the distinct missing-data messages.
- Select failed and failedCached, then retry. Confirm cached election choices do not compete with recovery. Select loading to verify that its deliberately supplied stale response stays hidden.
- Select fallback to check the election-ID mismatch notice.
- Select statewide to check the explicit coverage limit, empty normalized address, and a candidate marked withdrawn but still on the ballot.
- Select noAddress to check the entry form and national election-office fallback.
- Tap "Edit address" beside the submitted address, then submit blank, over-300-character, and valid addresses. Check validation, editing focus, cancellation, and recovery.
- Expand "Sources", "How to vote", and long measure text. Inspect field labels, supplied location details, narrow layouts, and large text on the target platform.

The fixture replaces request behavior. To test requests, mount the exported `BallotExperience` in a temporary test entry with an intercepted transport. Assert that discovery omits election ID, selection preserves the address and exact ID, both requests disable enrichment, address changes clear selection, and invalid input makes no request. Use fictional responses and remove the test entry afterward.

Run the applicable [package checks and production exports](../CONTRIBUTING.md#check-your-change). [Lookup tests](../apps/expo/src/utils/ballot-lookup.test.ts) cover state handling, missing fields, election alternatives, input bounds, and source URLs. Also check the public `/ballot` gate and custom TabBar in the production build.

Synthetic fixtures and bundle exports do not establish live provider coverage or installed-production behavior. Nationwide activation requires coverage evidence and release review; the public gate remains disabled.
