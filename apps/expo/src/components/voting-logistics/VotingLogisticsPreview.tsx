import { ScrollView, Text } from "react-native";

import type { VotingLogisticsData } from "~/utils/voting-logistics";
import { sp, typography, useTheme } from "~/styles";
import { VotingLogisticsSection } from "./VotingLogisticsSection";

/** Synthetic fixtures only. No addresses are sent to a provider. */
export const votingLogisticsFixture: VotingLogisticsData = {
  pollingLocations: [
    {
      name: "Example Community and Recreation Center",
      address: {
        line1: "123 Example Street",
        city: "Example City",
        state: "NC",
        zip: "",
      },
      pollingHours: "6:30 AM–7:30 PM",
      startDate: "2026-11-03",
      endDate: "2026-11-03",
      notes:
        "Use the accessible entrance on the east side of the community center. The main entrance faces the parking lot; follow the posted signs to the voting room. Staff at the entrance can help you find the accessible route.\n\nParking is available behind the building. The library entrance is separate from the voting entrance. Check the posted site instructions when you arrive.",
      sources: [
        {
          name: "Example County Board of Elections",
          official: true,
          url: "https://example.org/source",
        },
      ],
    },
  ],
  earlyVoteSites: [
    {
      name: "Example Regional Library",
      address: {
        line1: "789 Example Avenue",
        city: "Example City",
        state: "NC",
        zip: "",
      },
      pollingHours: "Monday–Friday, 9 AM–5 PM",
      endDate: "2026-10-31",
      sources: [{ name: "Example community source", official: false }],
    },
  ],
  dropOffLocations: [
    {
      name: "Example drop-off site",
      address: {
        line1: "456 Example Street",
        city: "Example City",
        state: "NC",
        zip: "",
      },
      pollingHours: "9 AM–5 PM",
      notes: "Use the marked ballot return slot beside the main entrance.",
    },
  ],
  state: [
    {
      name: "Example state",
      electionAdministrationBody: {
        votingLocationFinderUrl: "https://example.org/locations",
        electionRegistrationUrl: "https://example.org/register",
        absenteeVotingInfoUrl: "https://example.org/mail",
        ballotInfoUrl: "https://example.org/ballot",
      },
    },
  ],
};

/** Mount in a temporary local route to review all states without live data. */
export function VotingLogisticsPreview() {
  const { theme } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: sp[4] }}
    >
      <Text style={[typography.h2, { color: theme.foreground }]}>
        Synthetic voting logistics preview
      </Text>
      <VotingLogisticsSection status="ready" data={votingLogisticsFixture} />
      <VotingLogisticsSection status="ready" data={{ mailOnly: true }} />
      <VotingLogisticsSection
        status="ready"
        data={{ pollingLocations: votingLogisticsFixture.pollingLocations }}
      />
      <VotingLogisticsSection status="idle" />
      <VotingLogisticsSection status="loading" data={votingLogisticsFixture} />
      <VotingLogisticsSection status="error" data={votingLogisticsFixture} />
    </ScrollView>
  );
}
