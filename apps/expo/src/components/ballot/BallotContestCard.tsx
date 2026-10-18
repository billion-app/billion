import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { Contest } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useBallotTranslation } from "~/hooks/useBallotTranslation";
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
  const { t: tx, language: uiLanguage } = useAppTranslation();

  const router = useRouter();
  const isMeasure = isBallotMeasure(contest);
  const localization = useBallotTranslation(contest.translationReference, {
    kind: isMeasure ? "measure" : "contest",
    title:
      contest.referendumTitle ?? contest.office ?? contest.ballotTitle ?? "",
    candidates: contest.candidates?.map((candidate) => candidate.name) ?? [],
  });
  const title = isMeasure
    ? (localization.text("referendumTitle", contest.referendumTitle) ??
      contest.office ??
      tx("Ballot measure"))
    : localization.text(
        "office",
        localization.text("ballotTitle", contestListTitle(contest, uiLanguage)),
      );
  const count = contest.candidates?.length ?? 0;
  const sourceNames = contest.sources
    ?.map((source) => source.name)
    .filter(Boolean)
    .join(", ");
  const sourceLabel =
    (sourceNames?.length ?? 0) > 0 ? sourceNames : tx("unavailable");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        tx("Open {value1}", { value1: title }),
        electionDate
          ? ballotElectionDate(electionDate, uiLanguage)
          : tx("Election date unavailable"),
        contest.district?.name ?? tx("District unavailable"),
        electionStage?.trim()
          ? electionStage.trim()
          : tx("Election stage unavailable"),
        electionCoverageLabel("partial", uiLanguage),
        tx("Source: {value1}", { value1: sourceLabel ?? "" }),
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
          ballotContestRoute(
            contest,
            {
              state,
              electionDate,
              electionStage,
              provider,
            },
            uiLanguage,
          ),
        );
      }}
    >
      <Card style={s.card}>
        <View style={s.content}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.meta}>
            {isMeasure
              ? tx("Read measure details")
              : count
                ? tx("candidate.count", { count })
                : tx("Candidate information unavailable")}
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
