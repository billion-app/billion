import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { Contest } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import {
  ballotContestRoute,
  ballotElectionDate,
  isBallotMeasure,
} from "~/utils/ballot-lookup";
import { contestListTitle } from "~/utils/elections";
import { electionCoverageLabel } from "../ballot-evidence/election-status";

/** Compact ballot overview. Candidate names and evidence belong in the detail. */
export function BallotContestCard({
  contest,
  state,
  electionDate,
  electionStage,
  provider,
}: {
  contest: Contest;
  state?: string;
  electionDate?: string;
  electionStage?: string;
  provider?: { name: string; sourceUrl?: string; fetchedAt?: string };
}) {
  const router = useRouter();
  const isMeasure = isBallotMeasure(contest);
  const title = isMeasure
    ? (contest.referendumTitle ?? contest.office ?? "Ballot measure")
    : contestListTitle(contest);
  const count = contest.candidates?.length ?? 0;
  const sourceNames = contest.sources
    ?.map((source) => source.name)
    .filter(Boolean)
    .join(", ");
  const sourceLabel =
    (sourceNames?.length ?? 0) > 0 ? sourceNames : "unavailable";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `Open ${title}`,
        electionDate
          ? ballotElectionDate(electionDate)
          : "Election date unavailable",
        contest.district?.name ?? "District unavailable",
        electionStage?.trim()
          ? electionStage.trim()
          : "Election stage unavailable",
        electionCoverageLabel("partial"),
        `Source: ${sourceLabel}`,
      ].join(". ")}
      onPress={() => {
        if (!isMeasure) {
          posthog.capture("contest_detail_opened", {
            office: contest.office ?? null,
            district: contest.district?.name ?? null,
            candidate_count: count,
          });
        }
        router.push(
          ballotContestRoute(contest, {
            state,
            electionDate,
            electionStage,
            provider,
          }),
        );
      }}
    >
      <Card style={s.card}>
        <View style={s.content}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.meta}>
            {isMeasure
              ? "Read measure details"
              : count
                ? `${count} candidate${count === 1 ? "" : "s"}`
                : "Candidate information unavailable"}
          </Text>
        </View>
        <Icon name="chevR" size={16} color={colors.textSecondary} />
      </Card>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
    backgroundColor: planes.slate,
  },
  content: { flex: 1, gap: 4 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: "#FFFFFF",
  },
  meta: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
});
