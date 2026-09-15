import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { Contest } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { colors, fontBody } from "~/styles";
import { contestBallotCitations } from "~/utils/ballot-lookup";
import { contestListTitle } from "~/utils/elections";

/** Compact ballot overview. Candidate names and evidence belong in the detail. */
export function BallotContestCard({ contest }: { contest: Contest }) {
  const router = useRouter();
  const isMeasure = !!contest.referendumTitle;
  const title = contest.referendumTitle ?? contestListTitle(contest);
  const count = contest.candidates?.length ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={() => {
        if (isMeasure) {
          router.push({
            pathname: "/measure-detail",
            params: {
              referendumTitle: contest.referendumTitle ?? "",
              referendumSubtitle: contest.referendumSubtitle ?? "",
              referendumText: contest.referendumText ?? "",
              referendumUrl: contest.referendumUrl ?? "",
              referendumProStatement: contest.referendumProStatement ?? "",
              referendumConStatement: contest.referendumConStatement ?? "",
              summary: contest.summary ?? "",
              summaryLong: contest.summaryLong ?? contest.summary ?? "",
              summaryIsAiGenerated: contest.summaryIsAiGenerated
                ? "true"
                : "false",
              fiscalImpact: contest.fiscalImpact ?? "",
              proArguments: JSON.stringify(contest.proArguments ?? []),
              conArguments: JSON.stringify(contest.conArguments ?? []),
              citations: JSON.stringify(contestBallotCitations(contest)),
            },
          });
        } else {
          posthog.capture("contest_detail_opened", {
            office: contest.office ?? null,
            district: contest.district?.name ?? null,
            candidate_count: count,
          });
          router.push({
            pathname: "/contest-detail",
            params: {
              office: title,
              citations: JSON.stringify(contestBallotCitations(contest)),
              roles: JSON.stringify(contest.roles ?? []),
              levels: JSON.stringify(contest.level ?? []),
              candidates: JSON.stringify(contest.candidates ?? []),
              districtName: contest.district?.name ?? "",
              roleDescription: contest.roleDescription ?? "",
            },
          });
        }
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
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18 },
  content: { flex: 1, gap: 4 },
  title: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    lineHeight: 23,
    color: "#FFFFFF",
  },
  meta: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
