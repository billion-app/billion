/** Controlled fixture harness. Not registered as an app route or linked in production. */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

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
const ballot: BallotResponse = {
  kind: "fixture",
  election,
  otherElections: [special],
  normalizedInput: {
    line1: "123 Example Street",
    city: "Example",
    state: "NC",
    zip: "00000",
  },
  contests: [
    {
      type: "General",
      office: "Fixture city council",
      district: { name: "Example District 2" },
      candidates: [
        {
          name: "Alex Example",
          party: "Example party",
          citations: [
            {
              field: "name",
              sourceName: "Fixture candidate source",
              sourceUrl: "https://example.org/candidate-source",
              official: false,
              tier: "unknown",
            },
          ],
        },
        { name: "Jordan Sample", party: "Independent" },
      ],
      sources: [
        {
          name: "Fixture election office",
          official: true,
          url: "https://example.org/contest-source",
        },
      ],
    },
    {
      type: "Referendum",
      referendumTitle: "Fixture park measure",
      referendumSubtitle: "A fictional measure for layout testing.",
      referendumText:
        "This is synthetic measure text for reviewing the ballot layout. It is not an official proposal or voting guidance.\n\nA longer second paragraph tests whether the full source text remains readable when expanded. The text should wrap without truncation at larger accessibility sizes.",
      referendumUrl: "https://example.org/measure",
    },
  ],
  pollingLocations: [
    {
      name: "Fixture community center",
      address: {
        line1: "123 Example Street",
        city: "Example",
        state: "NC",
        zip: "00000",
      },
      pollingHours: "7 AM to 7 PM (fixture)",
      sources: [
        {
          name: "Fixture election office",
          official: true,
          url: "https://example.org/polling-source",
        },
      ],
    },
  ],
  state: [
    {
      name: "Fixture state",
      electionAdministrationBody: {
        electionInfoUrl: "https://example.org/election-office",
      },
    },
  ],
};
export const ballotFixtures = {
  NC: ballot,
  CA: {
    ...ballot,
    normalizedInput: { ...ballot.normalizedInput, state: "CA" },
    pollingLocations: undefined,
    state: undefined,
  },
  partial: {
    kind: "fixture",
    contests: [
      { type: "General", office: "Fixture race without candidate data" },
    ],
  },
  empty: { kind: "fixture", election, contests: [] },
  noData: { kind: "fixture" },
} satisfies Record<string, BallotResponse>;

type Scenario = keyof typeof ballotFixtures | "failed" | "loading" | "fallback";

export function BallotLookupFixture() {
  const [scenario, setScenario] = useState<Scenario>("NC");
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string>();
  const discovery =
    scenario === "failed"
      ? undefined
      : scenario === "loading" || scenario === "fallback"
        ? ballotFixtures.NC
        : ballotFixtures[scenario];
  const data =
    discovery && selected === special.id && scenario !== "fallback"
      ? {
          ...discovery,
          election: special,
          contests: [{ type: "Special", office: "Fixture special race" }],
        }
      : discovery;
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 16 }}>
        {(
          [
            "CA",
            "NC",
            "partial",
            "empty",
            "noData",
            "failed",
            "loading",
            "fallback",
          ] as const
        ).map((name) => (
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
        ))}
      </View>
      <BallotLookupView
        key={scenario}
        address="Fictional address"
        onAddress={() => {
          setScenario("NC");
          setSelected(undefined);
        }}
        discovery={discovery}
        data={data}
        settled={scenario !== "loading"}
        requestedElectionId={scenario === "fallback" ? special.id : selected}
        loading={scenario === "loading" || pending}
        failed={scenario === "failed"}
        onRetry={() => setScenario("NC")}
        onElection={(id) => {
          setPending(true);
          setTimeout(() => {
            setSelected(id);
            setPending(false);
          }, 400);
        }}
        renderCaliforniaResults={() => (
          <Text style={{ color: P.inkOnNight }}>
            California results slot (fixture, no network)
          </Text>
        )}
      />
    </View>
  );
}
