/** Synthetic, controlled fixture; never registered as a production route. */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { DigestPalette as P, sp, typography } from "~/styles";
import { PrivatePreparation } from "./PrivatePreparation";

export function PreparationFixture({
  hideControls = false,
  initialScenario = "ballot",
}: {
  hideControls?: boolean;
  initialScenario?: "ballot" | "changed" | "other" | "archive" | "paired";
}) {
  const [scenario, setScenario] = useState<
    "ballot" | "changed" | "other" | "archive" | "paired"
  >(initialScenario);
  const [showArchive, setShowArchive] = useState(false);
  const election = {
    id: scenario === "other" ? "fixture-special-2099" : "fixture-2099",
    name:
      scenario === "other"
        ? "Example special election (fixture)"
        : "Example general election (fixture)",
    electionDay: "2099-11-03",
    ocdDivisionId: "example",
  };
  return (
    <ScrollView
      style={{ backgroundColor: P.canvas }}
      contentContainerStyle={{ padding: sp[4], gap: sp[3] }}
    >
      {!hideControls && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp[3] }}>
          {(["ballot", "changed", "other", "archive", "paired"] as const).map(
            (value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                onPress={() => setScenario(value)}
                style={{ padding: sp[3] }}
              >
                <Text style={[typography.body, { color: P.inkOnNight }]}>
                  {value} fixture
                </Text>
              </Pressable>
            ),
          )}
        </View>
      )}
      {scenario === "paired" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowArchive(!showArchive)}
          style={{ padding: sp[3] }}
        >
          <Text style={[typography.body, { color: P.inkOnNight }]}>
            {showArchive ? "Back to fixture ballot" : "Open fixture archive"}
          </Text>
        </Pressable>
      )}
      <View
        style={
          scenario === "paired" && showArchive ? { display: "none" } : undefined
        }
      >
        <PrivatePreparation
          key={scenario}
          election={scenario === "archive" ? undefined : election}
          initiallyOpen={
            hideControls || scenario === "archive" || scenario === "paired"
          }
          onOpenBallot={() => setScenario("ballot")}
          provider="fixture"
          lookupScope="fixture-example-address"
          contests={
            scenario === "archive"
              ? []
              : [
                  {
                    type: "General",
                    office: "City Council, District 2",
                    candidates: [
                      {
                        name: "Alexandra Example-Sullivan",
                        ballotStatus:
                          scenario === "changed"
                            ? "withdrewStillOnBallot"
                            : "onBallot",
                      },
                      {
                        name: "Jordan Sample",
                        ballotStatus: "withdrewStillOnBallot",
                      },
                    ],
                  },
                  {
                    type: "Referendum",
                    referendumTitle: "Measure A: Parks and libraries",
                    referendumText: "Synthetic proposal",
                  },
                ]
          }
        />
      </View>
      {scenario === "paired" && (
        <View style={showArchive ? undefined : { display: "none" }}>
          <PrivatePreparation provider="fixture" initiallyOpen />
        </View>
      )}
    </ScrollView>
  );
}
