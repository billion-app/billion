import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { PrivatePreparation } from "~/components/preparation/PrivatePreparation";
import { NavHeader } from "~/components/ui";
import { VotingPlanSection } from "~/components/voting-plan/VotingPlanSection";
import { colors, fontBody, DigestPalette as P, sp } from "~/styles";
import { trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";

export default function GuidePreparation() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.isError ? undefined : query.data;
  const returnToGuide = () => router.back();
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <NavHeader
        title={mode === "notes" ? "Guide notes" : "Voting plan"}
        onBack={returnToGuide}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          gap: sp[4],
          paddingBottom: sp[12],
        }}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontBody.regular,
            fontSize: 12.5,
            lineHeight: 18,
          }}
        >
          California statewide guide · local races are not included.
        </Text>
        {mode === "notes" && !guide && (
          <PrivatePreparation provider="archive" initiallyOpen />
        )}
        {query.isPending ? (
          <ActivityIndicator color={P.inkOnNight} />
        ) : !guide ? (
          <SourceLink
            label="Read California’s official guide"
            url="https://voterguide.sos.ca.gov/"
          />
        ) : mode === "notes" ? (
          <PrivatePreparation
            heading="Your guide notes"
            initiallyOpen
            provider="California Secretary of State statement guide"
            lookupScope="statewide-guide:ca"
            election={{
              id: `ca-guide:${guide.electionDate}`,
              name: "California statewide guide",
              electionDay: guide.electionDate,
              ocdDivisionId: "ocd-division/country:us/state:ca",
            }}
            contests={[
              ...Array.from(
                new Map(
                  guide.candidates.map((candidate) => [
                    candidate.officeSlug,
                    {
                      type: "General",
                      office: candidate.officeName,
                    } satisfies Contest,
                  ]),
                ).values(),
              ),
              ...guide.measures.map(
                (measure) =>
                  ({
                    type: "Referendum",
                    referendumTitle: `Proposition ${measure.number}: ${measure.title}`,
                    referendumText: measure.officialSummary,
                  }) satisfies Contest,
              ),
            ]}
          />
        ) : (
          <VotingPlanSection
            initiallyOpen
            california
            returnLabel="Return to statewide guide"
            onReturn={returnToGuide}
            election={{
              id: `ca-guide:${guide.electionDate}`,
              name: `California statewide election · ${ballotElectionDate(guide.electionDate)}`,
              electionDay: guide.electionDate,
              ocdDivisionId: "ocd-division/country:us/state:ca",
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}
