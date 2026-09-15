/** Controlled fixture harness. Not registered as an app route or linked in production. */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { BallotLookupViewProps } from "./BallotLookupView";
import type { BallotResponse } from "~/utils/ballot-lookup";
import { DigestPalette as P } from "~/styles";
import { BallotLookupView } from "./BallotLookupView";

const election = {
  id: "fixture-general",
  name: "Fixture general election",
  electionDay: "2099-11-03",
  ocdDivisionId: "ocd-division/country:us",
};
const special = {
  ...election,
  id: "fixture-special",
  name: "Fixture special election",
};
export const ballotFixtures = {
  CA: {
    kind: "fixture",
    election,
    normalizedInput: {
      line1: "Fictional address",
      city: "Example",
      state: "CA",
      zip: "00000",
    },
    contests: [
      {
        type: "General",
        office: "Fixture council",
        candidates: [{ name: "Example candidate" }],
      },
    ],
  },
  NC: {
    kind: "fixture",
    election,
    otherElections: [special],
    normalizedInput: {
      line1: "Fictional address",
      city: "Example",
      state: "NC",
      zip: "00000",
    },
    contests: [
      {
        type: "General",
        office: "Fixture council",
        candidates: [{ name: "Example candidate" }],
      },
    ],
  },
  partial: {
    kind: "fixture",
    contests: [
      { type: "General", office: "Fixture race without candidate data" },
    ],
  },
  empty: { kind: "fixture", election, contests: [] },
} satisfies Record<string, BallotResponse>;

type Scenario = keyof typeof ballotFixtures | "failed" | "loading";

export function BallotLookupFixture(
  slots: Pick<BallotLookupViewProps, "renderSourceStatus" | "renderLogistics">,
) {
  const [scenario, setScenario] = useState<Scenario>("NC");
  const [selected, setSelected] = useState<string>();
  const discovery =
    scenario === "failed" || scenario === "loading"
      ? undefined
      : ballotFixtures[scenario];
  const data =
    discovery && selected === special.id
      ? {
          ...discovery,
          election: special,
          contests: [{ type: "Special", office: "Fixture special race" }],
        }
      : discovery;
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 16 }}>
        {(["CA", "NC", "partial", "empty", "failed", "loading"] as const).map(
          (name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              onPress={() => {
                setScenario(name);
                setSelected(undefined);
              }}
              style={{ padding: 12 }}
            >
              <Text style={{ color: P.spark }}>{name}</Text>
            </Pressable>
          ),
        )}
      </View>
      <BallotLookupView
        {...slots}
        key={scenario}
        address="Fictional address"
        onAddress={() => {
          setScenario("NC");
          setSelected(undefined);
        }}
        discovery={discovery}
        data={data}
        loading={scenario === "loading"}
        failed={scenario === "failed"}
        onRetry={() => setScenario("NC")}
        onElection={setSelected}
        renderCaliforniaResults={() => (
          <Text style={{ color: P.inkOnNight }}>
            California results slot (fixture, no network)
          </Text>
        )}
      />
    </View>
  );
}
