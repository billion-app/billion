# National voting logistics (#331)

The reusable [VotingLogisticsSection](../apps/expo/src/components/voting-logistics/VotingLogisticsSection.tsx) renders supplied voting locations and election-office information for any state. It makes no provider calls. The [derivation utilities](../apps/expo/src/utils/voting-logistics.ts) use existing `@acme/api` types through type-only imports.

## Integration handoff to #329

Mount the component in the dedicated ballot route, inside its scroll container:

```tsx
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";

<VotingLogisticsSection status="ready" data={voterInfo} />;
```

`data` accepts the existing response fields `pollingLocations`, `earlyVoteSites`, `dropOffLocations`, `mailOnly`, and `state`. A full `VoterInfoResponse` is compatible. Pass the successful response for the currently selected address and election. Set `status` to `idle`, `loading`, or `error` before that response is available. Those states suppress supplied data, including stale cached results. The route owns retry controls and broader coverage/source status from #330.

The component displays all supplied location hours, start/end date strings, notes, services, and source names without truncation. Dates remain attached to their location and are not interpreted as statewide dates or deadlines. A source receives an official label only when its `official` value is true. An absent source URL remains plain attribution. Only HTTP(S) links without embedded credentials are actionable.

The `state` administration bodies supply registration, absentee/mail voting, ballot information, location-finder, election-information, and rules links. Local offices appear before state offices. This relies on the existing `localJurisdiction` model; provider normalization belongs to the API owner. The component does not fabricate an office URL when none was supplied.

An empty location group says the lookup supplied no locations and directs the reader to their election office. It does not establish publication status or availability of a voting method. `mailOnly: true` is attributed to the supplied precinct data; it never promises automatic ballot mailing or a drop-off option. All supplied groups remain visible even when mail-only is set.

## Boundaries and dependencies

Route integration is intentionally pending #329. This change does not modify the Elections tab, navigation, address autocomplete, #272 content, provider selection, ingestion, or launch flags. It has no dependency on a new service or database migration.

Registration deadlines are not rendered because the existing response has no authoritative deadline field. Registration links are the fallback required by #331. A future #294 integration must carry authoritative citations before adding dates. Do not reuse `KeyDatesSection` for national registration deadlines: its current implementation subtracts 15 days from election day. Correcting that existing component belongs in coordinated #272 work. Personal registration status and ballot tracking are outside this response's capability.

The field contract was checked against Google's [voterInfoQuery reference](https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery) on September 14, 2026. That page documents the endpoint and its fields; it does not establish live coverage or nationwide readiness.

## Verification and preview

Run the focused Expo checks from [Contributing](../CONTRIBUTING.md#check-your-change). [Utility tests](../apps/expo/src/utils/voting-logistics.test.ts) cover supplied details, partial addresses, end-only dates, missing groups, mail-only combinations, office links, and unsafe URLs.

[VotingLogisticsPreview](../apps/expo/src/components/voting-logistics/VotingLogisticsPreview.tsx) is a complete synthetic preview with full, partial, mail-only, idle, loading, and error cases. To review locally, temporarily create `apps/expo/src/app/voting-logistics-preview.tsx` with:

```tsx
export { VotingLogisticsPreview as default } from "~/components/voting-logistics/VotingLogisticsPreview";
```

Open `/voting-logistics-preview` in the local app, using the mobile setup in Contributing. Remove the temporary route afterward. The preview is not a shipped route and never calls Civic or Places. Its `example.org` links and locations are synthetic, not election guidance. Check long notes, source attribution, link labels, narrow widths, and large text. Loading/error previews deliberately receive data to verify it stays hidden.
