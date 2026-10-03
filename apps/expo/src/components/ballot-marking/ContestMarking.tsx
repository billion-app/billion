import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import type { ContestInstructions } from "./model";
import {
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";
import {
  applicableInstructions,
  instructionDiagram,
  selectionLabel,
} from "./model";

function Detail({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.detail}>
      <Pressable
        style={s.detailAction}
        accessibilityRole="button"
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.detailLabel}>{title}</Text>
          {caption && <Text style={s.metadata}>{caption}</Text>}
        </View>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={P.inkOnNight}
        />
      </Pressable>
      {expanded && <View style={s.detailBody}>{children}</View>}
    </View>
  );
}

function MarkingExample({
  instructions,
}: {
  instructions: ContestInstructions;
}) {
  const diagram = instructionDiagram(instructions);
  const { fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(0);
  const showDiagram =
    diagram &&
    fontScale <= 1.3 &&
    (diagram.columns.length === 1 || availableWidth >= 240);
  return (
    <View
      style={s.example}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      <Text style={s.metadata}>Example only · not your ballot</Text>
      {showDiagram ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={instructions.example}
        >
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={s.diagram}
          >
            <View style={s.diagramRow}>
              <View style={s.exampleName} />
              {diagram.columns.map((column) => (
                <Text key={column} style={s.column}>
                  {column}
                </Text>
              ))}
            </View>
            {diagram.rows.map((row) => (
              <View key={row.label} style={s.diagramRow}>
                <Text style={[s.body, s.exampleName]}>{row.label}</Text>
                {diagram.columns.map((column, index) => (
                  <View key={column} style={s.targetCell}>
                    <View
                      style={[
                        s.oval,
                        row.filledColumns.includes(index) && s.filledOval,
                      ]}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={s.body}>{instructions.example}</Text>
      )}
    </View>
  );
}

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
      <Text style={s.kicker}>How to mark your ballot</Text>
      <Text accessibilityRole="header" style={s.answer}>
        {verified
          ? selectionLabel(verified)
          : "Check your official sample ballot"}
      </Text>
      <Text style={s.body}>
        {verified
          ? verified.marking
          : "Billion hasn’t verified marking instructions for this contest."}
      </Text>
      {verified ? (
        <>
          <View style={s.details}>
            <Detail
              key={`${verified.scope.contestId}:example`}
              title="See a marking example"
            >
              <MarkingExample instructions={verified} />
            </Detail>
            {(
              [
                ["Write-in instructions", verified.writeIns],
                ["If you mark too many choices", verified.overvotes],
                ["Leaving this contest blank", verified.blankContest],
              ] as const
            ).map(([title, text]) =>
              text ? (
                <Detail
                  key={`${verified.scope.contestId}:${title}`}
                  title={title}
                >
                  <Text style={s.body}>{text}</Text>
                </Detail>
              ) : null,
            )}
            <Detail
              key={`${verified.scope.contestId}:details`}
              title="Sources & details"
              caption={verified.source.authority}
            >
              <View style={s.source}>
                <SourceLink
                  label="Official instructions"
                  prominence="primary"
                  url={verified.source.url}
                />
              </View>
              <Text style={s.body}>Voting system: {verified.system}</Text>
              {verified.electionStage && (
                <View style={s.section}>
                  <Text accessibilityRole="header" style={s.detailLabel}>
                    About this election
                  </Text>
                  <Text style={s.body}>{verified.electionStage}</Text>
                </View>
              )}
              <Text style={s.metadata}>
                Reviewed {verified.source.reviewedAt}
              </Text>
            </Detail>
          </View>
        </>
      ) : (
        <ElectionOfficeLink prominence="primary" />
      )}
      <Text style={s.metadata}>
        Use your official ballot to vote. Billion does not submit votes.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    gap: sp[2],
    padding: sp[4],
    marginVertical: sp[4],
    backgroundColor: P.card,
    borderRadius: DigestRadii.menu,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
  },
  answer: {
    fontFamily: fontEditorial.bold,
    fontSize: 26,
    lineHeight: 33,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  metadata: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 20,
    color: P.inkOnNight,
    opacity: 0.85,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.cardBorder,
  },
  detail: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  detailAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
    paddingVertical: sp[2],
  },
  detailLabel: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  detailBody: { paddingBottom: sp[3], gap: sp[2] },
  section: { gap: sp[2] },
  source: { alignSelf: "flex-start", maxWidth: "100%" },
  example: { gap: sp[2] },
  diagram: {
    gap: sp[2],
    padding: sp[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
  },
  diagramRow: { flexDirection: "row", alignItems: "center", gap: sp[2] },
  exampleName: { flex: 2 },
  column: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
    textAlign: "center",
  },
  targetCell: { flex: 1, alignItems: "center" },
  oval: {
    width: 20,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: P.inkOnNight,
  },
  filledOval: { backgroundColor: P.inkOnNight },
});
