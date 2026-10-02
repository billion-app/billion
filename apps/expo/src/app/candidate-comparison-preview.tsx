import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { comparisonFixture } from "~/components/candidate-comparison/fixtures";
import { RaceComparisonView } from "~/components/candidate-comparison/RaceComparisonView";
import { NavHeader } from "~/components/ui";
import { Segmented } from "~/components/ui/Segmented";
import { fontBody, DigestPalette as P } from "~/styles";

export default function CandidateComparisonPreview() {
  const router = useRouter();
  const [scenario, setScenario] = useState("multi");
  return (
    <View style={s.screen}>
      <NavHeader
        title="Compare candidates"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        {__DEV__ ? (
          <>
            <Text style={s.body}>
              Synthetic scenarios · No live ballot data
            </Text>
            <Segmented
              value={scenario}
              onChange={setScenario}
              options={[
                { id: "two", label: "Two" },
                { id: "multi", label: "Three" },
                { id: "long", label: "Eight" },
                { id: "sparse", label: "Sparse" },
              ]}
            />
            <RaceComparisonView
              key={scenario}
              race={comparisonFixture(scenario)}
            />
          </>
        ) : (
          <Text style={s.body}>
            Candidate comparisons are not published. Editorial policy and
            reviewed evidence are required before launch.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: 20, paddingBottom: 60, gap: 20 },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 25,
    color: P.inkOnNight,
  },
});
