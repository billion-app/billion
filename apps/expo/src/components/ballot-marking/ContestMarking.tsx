import { StyleSheet, View } from "react-native";

import type { ContestInstructions } from "./model";
import {
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";
import { applicableInstructions, selectionLabel } from "./model";

export function ContestMarking({
  instructions,
  scope,
}: {
  instructions?: ContestInstructions;
  scope: ContestInstructions["scope"];
}) {
  const verified = applicableInstructions(instructions, scope);
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>
        How to mark this contest
      </Text>
      {verified ? (
        <>
          <Text style={s.heading}>{selectionLabel(verified)}</Text>
          <Text style={s.body}>Voting system: {verified.system}</Text>
          <Text style={s.body}>{verified.marking}</Text>
          <Text accessibilityRole="header" style={s.heading}>
            Instructional example · not a ballot
          </Text>
          <Text style={s.body}>{verified.example}</Text>
          {(
            [
              ["Write-ins", verified.writeIns],
              ["Too many marks", verified.overvotes],
              ["Leaving this contest blank", verified.blankContest],
              [
                "Election stage · separate from marking",
                verified.electionStage,
              ],
            ] as const
          ).map(([label, text]) =>
            text ? (
              <View key={label} style={s.section}>
                <Text accessibilityRole="header" style={s.heading}>
                  {label}
                </Text>
                <Text style={s.body}>{text}</Text>
              </View>
            ) : null,
          )}
          <Text style={s.body}>
            Instructions from {verified.source.authority}. Reviewed{" "}
            {verified.source.reviewedAt}.
          </Text>
          <SourceLink
            label="Official ballot instructions"
            prominence="primary"
            url={verified.source.url}
          />
        </>
      ) : (
        <>
          <Text style={s.body}>
            Instructions not verified for this contest. Check your election
            office’s sample ballot for how many choices you may mark, whether to
            rank them, and any write-in rules.
          </Text>
          <ElectionOfficeLink prominence="primary" />
        </>
      )}
      <Text style={s.body}>
        Billion does not submit votes. Use your official ballot to vote.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    gap: sp[3],
    padding: sp[4],
    marginVertical: sp[4],
    backgroundColor: P.card,
    borderRadius: DigestRadii.menu,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  section: { gap: sp[2] },
});
