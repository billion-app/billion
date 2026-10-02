/** Controlled renderer harness. Not registered as a route or linked in production. */
import { ScrollView, StyleSheet } from "react-native";

import type { ContestInstructions } from "./model";
import { DigestPalette as P, sp } from "~/styles";
import { ContestMarking } from "./ContestMarking";

const scope = {
  contestId: "fixture-council",
  electionDate: "2026-11-03",
  jurisdiction: "Synthetic jurisdiction",
};
const base: ContestInstructions = {
  scope,
  source: {
    authority: "Synthetic election office (fixture)",
    url: "https://example.org/fixture",
    reviewedAt: "2026-10-02",
  },
  system: "Synthetic plurality example",
  mechanics: { kind: "single", maximum: 1 },
  marking: "Fixture only: fill the oval beside your choice.",
  electionStage:
    "Fixture only: this general election follows a separate primary election. This does not change how to mark this contest.",
  example:
    "Candidate A: filled oval. Candidate B: empty oval. One choice marked.",
};
export function ContestMarkingFixture({
  kind = "single",
}: {
  kind?: "single" | "multiple" | "ranked" | "unknown";
}) {
  const instructions: ContestInstructions | undefined =
    kind === "unknown"
      ? undefined
      : {
          ...base,
          mechanics:
            kind === "single" ? { kind, maximum: 1 } : { kind, maximum: 3 },
          system:
            kind === "ranked" ? "Synthetic ranked-choice example" : base.system,
          marking:
            kind === "ranked"
              ? "Fixture only: mark a different candidate in each rank column."
              : kind === "multiple"
                ? "Fixture only: fill ovals beside up to three different candidates."
                : base.marking,
          example:
            kind === "ranked"
              ? "First choice: Candidate A. Second choice: Candidate B. Third choice: Candidate C."
              : kind === "multiple"
                ? "Candidate A and Candidate B: filled ovals. Candidate C: empty oval. Two choices marked; limit three."
                : base.example,
        };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.canvas }}
      contentContainerStyle={s.screen}
    >
      <ContestMarking instructions={instructions} scope={scope} />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  screen: { padding: sp[4], backgroundColor: P.canvas },
});
