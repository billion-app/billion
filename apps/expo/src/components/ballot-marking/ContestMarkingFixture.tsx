/** Controlled renderer harness. Not registered as a route or linked in production. */
import { ScrollView, StyleSheet } from "react-native";

import type { ContestInstructions } from "./model";
import { DigestPalette as P, sp } from "~/styles";
import { ContestMarking } from "./ContestMarking";

export type MarkingFixtureKind = "single" | "multiple" | "ranked" | "unknown";
export const markingFixtureScope = {
  contestId: "fixture-council",
  electionDate: "2026-11-03",
  jurisdiction: "Synthetic jurisdiction",
};
const base: ContestInstructions = {
  scope: markingFixtureScope,
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
export function markingFixtureInstructions(
  kind: MarkingFixtureKind,
): ContestInstructions | undefined {
  if (kind === "unknown") return;
  return {
    ...base,
    mechanics: kind === "single" ? { kind, maximum: 1 } : { kind, maximum: 3 },
    system: kind === "ranked" ? "Synthetic ranked-choice example" : base.system,
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
    exampleDiagram: {
      target: "oval",
      columns: kind === "ranked" ? ["1st", "2nd", "3rd"] : ["Mark"],
      rows: (kind === "single"
        ? ["Candidate A", "Candidate B"]
        : ["Candidate A", "Candidate B", "Candidate C"]
      ).map((label, index) => ({
        label,
        filledColumns:
          kind === "ranked"
            ? [index]
            : kind === "multiple"
              ? index < 2
                ? [0]
                : []
              : index === 0
                ? [0]
                : [],
      })),
    },
  };
}
export function ContestMarkingFixture({
  kind = "single",
}: {
  kind?: MarkingFixtureKind;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.canvas }}
      contentContainerStyle={s.screen}
    >
      <ContestMarking
        instructions={markingFixtureInstructions(kind)}
        scope={markingFixtureScope}
      />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  screen: { padding: sp[4], backgroundColor: P.canvas },
});
