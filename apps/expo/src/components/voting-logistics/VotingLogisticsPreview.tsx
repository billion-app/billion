import { ScrollView, Text } from "react-native";

import type { VotingLogisticsData } from "~/utils/voting-logistics";
import { sp, typography, useTheme } from "~/styles";
import { VotingLogisticsSection } from "./VotingLogisticsSection";

/** Synthetic fixtures only. No addresses are sent to a provider. */
const complete: VotingLogisticsData = {
  pollingLocations: [
    {
      name: "Example community center",
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
        "Example note: use the accessible entrance on the east side. This long note must remain fully visible at large text sizes and must never be truncated.",
      sources: [
        {
          name: "Example election office",
          official: true,
          url: "https://example.org/source",
        },
      ],
    },
  ],
  earlyVoteSites: [
    {
      address: { line1: "", city: "Example City", state: "NC", zip: "" },
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
      notes: "Example instructions supplied by the source.",
    },
  ],
  state: [
    {
      name: "Example state",
      electionAdministrationBody: {
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
      <VotingLogisticsSection status="ready" data={complete} />
      <VotingLogisticsSection status="ready" data={{ mailOnly: true }} />
      <VotingLogisticsSection
        status="ready"
        data={{ pollingLocations: complete.pollingLocations }}
      />
      <VotingLogisticsSection status="idle" />
      <VotingLogisticsSection status="loading" data={complete} />
      <VotingLogisticsSection status="error" data={complete} />
    </ScrollView>
  );
}
