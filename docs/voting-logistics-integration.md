# Voting logistics

[VotingLogisticsSection](../apps/expo/src/components/voting-logistics/VotingLogisticsSection.tsx) presents supplied locations and voting-information links for the selected address and election. It makes no provider calls and imports API types only.

## Component contract

```tsx
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";

<VotingLogisticsSection status="ready" data={voterInfo} />;
```

Mount inside the route's scroll container. The component provides its own heading; the route supplies horizontal padding. `data` accepts `pollingLocations`, `earlyVoteSites`, `dropOffLocations`, `mailOnly`, and `state`; a full `VoterInfoResponse` is compatible. Pass only the successful response for the selected address and election. `idle`, `loading`, and `error` suppress supplied data, including stale results. The route owns retry controls and broader coverage status.

Compact groups summarize supplied Election Day, early-voting, and ballot drop-off locations. Opening a group reveals names, addresses, hours, and supplied date endpoints. Empty groups are omitted. Identical date endpoints appear once. Valid calendar dates use readable month labels without time-zone shifts; other source date text remains unchanged. "Notes & sources" opens a reading panel with original paragraphs, services, and attribution. Text scales without truncation; disclosure controls expose their expanded state and have at least 44-point touch targets.

A resources panel describes missing location groups without establishing publication status or voting-method availability. With links only, this panel is the complete overview; no voting methods are fabricated. The mail-only notice attributes the indicator to the lookup and directs readers to the election office for return instructions. "About this information" explains registration and tracking limitations.

## Links and evidence

The [utilities](../apps/expo/src/utils/voting-logistics.ts) use supplied administration-body URLs and preserve the supplied organization name. If no administration-body name is supplied, region source names appear as attribution. The container field alone does not establish that a link is official. Local offices appear first, with location finders first within each office. An explicitly mail-only lookup puts a supplied mail-information link first. Each URL appears once; a shared destination serving several purposes is labeled "Voting information website." Distinct pages remain available. HTTP(S) links reject embedded credentials. Missing source URLs remain plain attribution. When no administration-body links are supplied, the shared election-office action opens the USAGov directory. When registration is the only supplied resource and no locations are returned, the election-office directory remains the primary way to find location details, with registration links below it. Otherwise, with no locations returned, the first information link is prominent; populated locations remain the focus otherwise. Sources receive an official label only when `official` is true.

The response has no registration deadline, eligibility, personal registration status, or mail-ballot tracking fields. The component links to supplied registration information. `KeyDatesSection` subtracts 15 days from election day and cannot supply national registration deadlines.

Provider normalization, ingestion, and launch flags remain outside this component. A lookup may return only links; absent location arrays do not establish that no voting locations exist.

## Preview and checks

[VotingLogisticsPreview](../apps/expo/src/components/voting-logistics/VotingLogisticsPreview.tsx) contains synthetic locations, original-length notes, links, and loading/error states. Mount it temporarily in a local route:

```tsx
export { VotingLogisticsPreview as default } from "~/components/voting-logistics/VotingLogisticsPreview";
```

Remove the temporary route after use. Fixtures never call a provider, and `example.org` links are not election guidance. Check disclosure open/close, long paragraphs, attribution, missing groups, and stale-data suppression at default and larger text sizes. Follow [Contributing](../CONTRIBUTING.md#check-your-change) for Expo checks; [utility tests](../apps/expo/src/utils/voting-logistics.test.ts) cover partial data and safe, deduplicated links.
