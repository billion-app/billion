import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { comparisonFixture } from "~/components/candidate-comparison/fixtures";
import { RaceComparisonView } from "~/components/candidate-comparison/RaceComparisonView";
import { NavHeader } from "~/components/ui";
import { Segmented } from "~/components/ui/Segmented";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { fontBody, DigestPalette as P } from "~/styles";

export default function CandidateComparisonPreview() {
  const { t: tx } = useAppTranslation();

  const router = useRouter();
  const [scenario, setScenario] = useState("multi");
  const [showScenarios, setShowScenarios] = useState(false);
  return (
    <View style={s.screen}>
      <NavHeader
        title={tx("Compare candidates")}
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        {__DEV__ ? (
          <>
            <RaceComparisonView
              key={scenario}
              race={comparisonFixture(scenario)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showScenarios }}
              style={{ minHeight: 44, justifyContent: "center" }}
              onPress={() => setShowScenarios(!showScenarios)}
            >
              <Text style={s.body}>
                {tx("Change fictional example · {value1}", {
                  value1:
                    scenario === "long"
                      ? "8 candidates"
                      : scenario === "two"
                        ? "2 candidates"
                        : scenario === "sparse"
                          ? "Sparse evidence"
                          : "3 candidates",
                })}
              </Text>
            </Pressable>
            {showScenarios && (
              <Segmented
                value={scenario}
                onChange={(next) => {
                  setScenario(next);
                  setShowScenarios(false);
                }}
                options={[
                  { id: "two", label: tx("Two") },
                  { id: "multi", label: tx("Three") },
                  { id: "long", label: tx("Eight") },
                  { id: "sparse", label: tx("Sparse") },
                ]}
              />
            )}
          </>
        ) : (
          <Text style={s.body}>
            {tx(
              "Candidate comparisons are not published. Editorial policy and reviewed evidence are required before launch.",
            )}
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
