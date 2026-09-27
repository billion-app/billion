import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { GovernanceExample, GovernanceNode } from "~/utils/governance-map";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import { governanceMaps } from "~/utils/governance-map";

const KINDS = {
  choice: "START",
  power: "CAN",
  check: "CHECK",
  condition: "NEXT",
} as const;

function MapStep({
  node,
  index,
  sourceLabel,
  showRail = true,
}: {
  node: GovernanceNode;
  index: number;
  sourceLabel: string;
  showRail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.stepRow}>
      {showRail && (
        <View style={s.rail} accessible={false}>
          <View style={[s.dot, node.kind === "check" && s.checkDot]} />
          <View style={s.line} />
        </View>
      )}
      <View style={s.step}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${index + 1}. ${node.label}. ${KINDS[node.kind]}. ${open ? "Collapse" : "Expand"} details`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
        >
          <Text style={s.tag}>{KINDS[node.kind]}</Text>
          <Text style={s.stepTitle}>{node.label}</Text>
          <Text style={s.expand}>{open ? "Hide detail −" : "See how +"}</Text>
        </Pressable>
        {open && (
          <View style={s.stepBody}>
            <Text style={s.detail}>{node.detail}</Text>
            <Text style={s.source}>Source: {sourceLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function GovernanceMapScreen() {
  const router = useRouter();
  const { example } = useLocalSearchParams<{ example?: string }>();
  const selected: GovernanceExample =
    example === "prop-4-2026" ? "prop-4-2026" : "governor";
  const [textMode, setTextMode] = useState(false);
  const map = governanceMaps[selected];
  return (
    <View style={s.screen}>
      <NavHeader
        title="How this vote works"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>{map.eyebrow}</Text>
        <Text accessibilityRole="header" style={s.title}>
          {map.title}
        </Text>
        <Text style={s.takeaway}>{map.takeaway}</Text>
        <View style={s.switchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !textMode }}
            onPress={() => setTextMode(false)}
            style={[s.mode, !textMode && s.activeMode]}
          >
            <Text style={[s.modeText, !textMode && s.activeModeText]}>Map</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: textMode }}
            onPress={() => setTextMode(true)}
            style={[s.mode, textMode && s.activeMode]}
          >
            <Text style={[s.modeText, textMode && s.activeModeText]}>
              Text version
            </Text>
          </Pressable>
        </View>
        <Text style={s.sectionTitle}>
          {selected === "governor"
            ? "From ballot to office"
            : "From current rule to each choice"}
        </Text>
        {textMode ? (
          <View style={s.textCard}>
            {map.nodes.map((node, index) => (
              <View key={node.id} style={s.textItem}>
                <Text accessibilityRole="header" style={s.textHeading}>
                  {index + 1}. {node.label}
                </Text>
                <Text style={s.detail}>{node.detail}</Text>
                <Text style={s.source}>
                  Source:{" "}
                  {
                    map.sources.find((source) => source.id === node.source)
                      ?.label
                  }
                </Text>
              </View>
            ))}
          </View>
        ) : selected === "prop-4-2026" ? (
          <View>
            {map.nodes
              .filter((node) => node.id === "current")
              .map((node) => (
                <MapStep
                  key={node.id}
                  index={0}
                  node={node}
                  showRail={false}
                  sourceLabel={map.sources[0]?.label ?? "Official source"}
                />
              ))}
            <Text accessibilityRole="header" style={s.branchLabel}>
              IF YES PASSES
            </Text>
            {map.nodes
              .filter((node) => node.id === "yes" || node.id === "next")
              .map((node, index) => (
                <MapStep
                  key={node.id}
                  index={index + 1}
                  node={node}
                  showRail={false}
                  sourceLabel={map.sources[0]?.label ?? "Official source"}
                />
              ))}
            <Text accessibilityRole="header" style={s.branchLabel}>
              OR IF NO PASSES
            </Text>
            {map.nodes
              .filter((node) => node.id === "no")
              .map((node) => (
                <MapStep
                  key={node.id}
                  index={3}
                  node={node}
                  showRail={false}
                  sourceLabel={map.sources[0]?.label ?? "Official source"}
                />
              ))}
          </View>
        ) : (
          <View>
            {map.nodes.map((node, index) => (
              <MapStep
                key={node.id}
                index={index}
                node={node}
                sourceLabel={
                  map.sources.find((source) => source.id === node.source)
                    ?.label ?? "Official source"
                }
              />
            ))}
          </View>
        )}
        <View style={s.note}>
          <Text accessibilityRole="header" style={s.noteTitle}>
            What this does not promise
          </Text>
          <Text style={s.noteBody}>{map.caveat}</Text>
        </View>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          Official sources
        </Text>
        {map.sources.map((source) => (
          <SourceLink key={source.id} label={source.label} url={source.url} />
        ))}
        <Text style={s.footer}>
          Reviewed example for the November 2026 California election. The map
          explains formal rules; it does not predict an outcome.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: 22, paddingBottom: 70, gap: 18 },
  eyebrow: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  title: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 35,
    lineHeight: 40,
  },
  takeaway: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.regular,
    fontSize: 20,
    lineHeight: 29,
  },
  switchRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 13,
    backgroundColor: P.stone,
  },
  mode: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 10,
  },
  activeMode: { backgroundColor: P.paper },
  modeText: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 14,
  },
  activeModeText: { color: P.ink },
  sectionTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    marginTop: 6,
  },
  branchLabel: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: 10,
    marginBottom: 10,
  },
  stepRow: { flexDirection: "row", gap: 10 },
  rail: { width: 20, alignItems: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: P.spark,
    marginTop: 23,
  },
  checkDot: { backgroundColor: P.copper },
  line: { width: 1, backgroundColor: P.quiet, flex: 1, marginVertical: 5 },
  step: {
    flex: 1,
    backgroundColor: P.stone,
    borderRadius: 16,
    padding: 17,
    marginBottom: 12,
  },
  tag: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  stepTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 19,
    lineHeight: 25,
    marginTop: 5,
  },
  stepBody: { gap: 10, marginTop: 12 },
  detail: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  source: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  expand: {
    color: P.spark,
    fontFamily: fontBody.semibold,
    fontSize: 13,
    marginTop: 12,
  },
  textCard: {
    backgroundColor: P.stone,
    borderRadius: 16,
    padding: 18,
    gap: 20,
  },
  textItem: { gap: 7 },
  textHeading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
  },
  note: {
    borderLeftWidth: 3,
    borderLeftColor: P.copper,
    backgroundColor: P.stone,
    padding: 16,
    gap: 8,
  },
  noteTitle: { color: P.inkOnNight, fontFamily: fontBody.bold, fontSize: 14 },
  noteBody: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
