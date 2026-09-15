# Voting logistics

[VotingLogisticsSection](../apps/expo/src/components/voting-logistics/VotingLogisticsSection.tsx) presents supplied locations and official information for the selected address and election. It makes no provider calls and imports API types only.

## Component contract

```tsx
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";

<VotingLogisticsSection status="ready" data={voterInfo} />;
```

Mount inside the route's scroll container. The component provides its own heading and 16-point padding. `data` accepts `pollingLocations`, `earlyVoteSites`, `dropOffLocations`, `mailOnly`, and `state`; a full `VoterInfoResponse` is compatible. Pass only the successful response for the selected address and election. `idle`, `loading`, and `error` suppress supplied data, including stale results. The route owns retry controls and broader coverage status.

Location rows group Election Day, early voting, and ballot drop-off sites. Names, addresses, hours, and supplied date endpoints stay visible. Identical date endpoints appear once. "Notes & sources" opens a titled reading panel with original paragraphs, services, and attribution. Text scales without truncation; disclosure controls expose their expanded state and have at least 44-point touch targets.

One notice describes missing location groups without establishing publication status or voting-method availability. The mail-only notice attributes the indicator to the lookup and directs readers to official return instructions. "About this information" explains registration and tracking limitations.

## Official links and evidence

The [utilities](../apps/expo/src/utils/voting-logistics.ts) use supplied administration-body URLs. Local offices appear first, with location finders first within each office. Each URL appears once; a shared destination serving several purposes is labeled "Election office website." Distinct pages remain available. HTTP(S) links reject embedded credentials. Missing URLs remain plain attribution. Sources receive an official label only when `official` is true.

The response has no registration deadline, eligibility, personal registration status, or mail-ballot tracking fields. The component links to official registration information. `KeyDatesSection` subtracts 15 days from election day and cannot supply national registration deadlines.

Google's [voterInfoQuery field reference](https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery) defines the provider fields; it does not establish live coverage. Provider normalization, ingestion, and launch flags remain outside this component.

## Preview and checks

[VotingLogisticsPreview](../apps/expo/src/components/voting-logistics/VotingLogisticsPreview.tsx) contains synthetic locations, original-length notes, links, and loading/error states. Mount it temporarily in a local route:

```tsx
export { VotingLogisticsPreview as default } from "~/components/voting-logistics/VotingLogisticsPreview";
```

Remove the temporary route after use. Fixtures never call a provider, and `example.org` links are not election guidance. Check disclosure open/close, long paragraphs, attribution, missing groups, and stale-data suppression at default and larger text sizes. Follow [Contributing](../CONTRIBUTING.md#check-your-change) for Expo checks; [utility tests](../apps/expo/src/utils/voting-logistics.test.ts) cover partial data and safe, deduplicated links.
