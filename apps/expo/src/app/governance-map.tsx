import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type {
  GovernanceExample,
  GovernanceMap,
  GovernanceNode,
} from "~/utils/governance-map";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader } from "~/components/ui";
import { Icon } from "~/components/ui/Icon";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  planes,
} from "~/styles";
import { governanceMaps } from "~/utils/governance-map";

function node(map: GovernanceMap, id: string) {
  const found = map.nodes.find((item) => item.id === id);
  if (!found) throw new Error(`Missing governance node: ${id}`);
  return found;
}

function sourceLabel(map: GovernanceMap, item: GovernanceNode) {
  return (
    map.sources.find((source) => source.id === item.source)?.label ??
    "Official source"
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <View style={s.connector} accessible={false}>
      <View style={s.connectorLine} />
      {label && <Text style={s.connectorLabel}>{label}</Text>}
      <Icon name="arrowDown" size={14} color={P.quiet} />
    </View>
  );
}

function DiagramPoint({
  label,
  note,
  kind,
  active,
  onPress,
}: {
  label: string;
  note?: string;
  kind: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${kind}. ${label}${note ? `. ${note}` : ""}. ${active ? "Hide" : "Show"} source detail`}
      accessibilityState={{ expanded: active }}
      onPress={onPress}
      style={[s.point, active && s.pointActive]}
    >
      <Text style={s.pointKind}>{kind}</Text>
      <Text style={s.pointTitle}>{label}</Text>
      {note && <Text style={s.pointNote}>{note}</Text>}
    </Pressable>
  );
}

function OfficeDiagram({
  map,
  selected,
  select,
  stacked,
}: {
  map: GovernanceMap;
  selected: string | null;
  select: (id: string) => void;
  stacked: boolean;
}) {
  const lanes = [
    {
      power: "budget",
      check: "legislature",
      action: "Proposes budget",
      limit: "Legislature approves spending",
    },
    {
      power: "law",
      check: "legislature",
      action: "Signs or vetoes bills",
      limit: "Legislature passes bills or overrides veto",
    },
    {
      power: "appointments",
      check: "confirmation",
      action: "Appoints officials",
      limit: "Senate confirms some appointments",
    },
  ] as const;
  return (
    <View>
      <View style={s.origin}>
        <View style={s.iconTile}>
          <Icon name="vote" size={17} color={P.primary} />
        </View>
        <Text style={s.originText}>Voters elect a Governor</Text>
        <Text style={s.originMeta}>4-year term</Text>
      </View>
      <Connector label="OFFICE POWERS & CHECKS" />
      <View style={s.diagram}>
        {!stacked && (
          <View style={s.officeHead}>
            <Text style={s.columnHead}>GOVERNOR CAN</Text>
            <Text style={s.columnHead}>OTHER INSTITUTIONS</Text>
          </View>
        )}
        {lanes.map((lane, index) => (
          <View
            key={lane.power}
            style={[
              s.lane,
              stacked && s.laneStacked,
              index > 0 && s.laneBorder,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${lane.action}. ${node(map, lane.power).detail}. Show source detail`}
              accessibilityState={{ expanded: selected === lane.power }}
              onPress={() => select(lane.power)}
              style={s.laneSide}
            >
              {stacked && (
                <Text style={[s.columnHead, s.stackedColumnHead]}>
                  GOVERNOR CAN
                </Text>
              )}
              <Text style={s.laneAction}>{lane.action}</Text>
            </Pressable>
            <Icon
              name={stacked ? "arrowDown" : "arrowRight"}
              size={16}
              color={P.primary}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${lane.limit}. ${node(map, lane.check).detail}. Show source detail`}
              accessibilityState={{ expanded: selected === lane.check }}
              onPress={() => select(lane.check)}
              style={s.laneSide}
            >
              {stacked && (
                <Text style={[s.columnHead, s.stackedColumnHead]}>
                  OTHER INSTITUTIONS
                </Text>
              )}
              <Text style={s.laneLimit}>{lane.limit}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={s.diagramHint}>
        Tap a power or check for its rule and source.
      </Text>
    </View>
  );
}

function MeasureDiagram({
  map,
  selected,
  select,
  stacked,
}: {
  map: GovernanceMap;
  selected: string | null;
  select: (id: string) => void;
  stacked: boolean;
}) {
  return (
    <View>
      <DiagramPoint
        kind="CURRENT RULE"
        label="Most public campaign funding is banned"
        note="Some charter cities are exceptions"
        active={selected === "current"}
        onPress={() => select("current")}
      />
      <Connector label="IF THE MEASURE PASSES OR FAILS" />
      <View style={[s.branches, stacked && s.branchesStacked]}>
        <View style={s.branch}>
          <DiagramPoint
            kind="IF YES PASSES"
            label="Ban lifts"
            note="Programs become possible, within limits"
            active={selected === "yes"}
            onPress={() => select("yes")}
          />
          <View style={s.branchTail}>
            <Icon name="arrowDown" size={14} color={P.primary} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Later decision. ${node(map, "next").detail}. Show source detail`}
              accessibilityState={{ expanded: selected === "next" }}
              onPress={() => select("next")}
            >
              <Text style={s.tailTitle}>Later decision</Text>
              <Text style={s.tailNote}>Any program needs later approval</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.branch}>
          <DiagramPoint
            kind="IF MEASURE FAILS"
            label="Ban stays"
            note="Existing rule remains for most governments"
            active={selected === "no"}
            onPress={() => select("no")}
          />
        </View>
      </View>
      <Text style={s.diagramHint}>
        A Yes result permits later action; it does not create a program.
      </Text>
    </View>
  );
}

export default function GovernanceMapScreen() {
  const router = useRouter();
  const { example, view } = useLocalSearchParams<{
    example?: string;
    view?: string;
  }>();
  const selected: GovernanceExample =
    example === "prop-4-2026" ? "prop-4-2026" : "governor";
  const [modeState, setModeState] = useState({
    view,
    textMode: view === "text",
  });
  const textMode =
    modeState.view === view ? modeState.textMode : view === "text";
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { width, fontScale } = useWindowDimensions();
  const map = governanceMaps[selected];
  const activeNode = map.nodes.find((item) => item.id === selectedNode);
  const selectNode = (id: string) =>
    setSelectedNode((current) => (current === id ? null : id));
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
            onPress={() => setModeState({ view, textMode: false })}
            style={[s.mode, !textMode && s.activeMode]}
          >
            <Text style={[s.modeText, !textMode && s.activeModeText]}>Map</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: textMode }}
            onPress={() => setModeState({ view, textMode: true })}
            style={[s.mode, textMode && s.activeMode]}
          >
            <Text style={[s.modeText, textMode && s.activeModeText]}>
              Text version
            </Text>
          </Pressable>
        </View>
        <View style={s.sectionRow}>
          <Text accessibilityRole="header" style={s.sectionTitle}>
            {selected === "governor"
              ? "Who holds the power"
              : "What each result changes"}
          </Text>
          <Text style={s.sectionMeta}>OFFICIAL RULES</Text>
        </View>
        {textMode ? (
          <View style={s.textCard}>
            {map.nodes.map((item, index) => (
              <View
                key={item.id}
                style={[s.textItem, index > 0 && s.textItemBorder]}
              >
                <Text accessibilityRole="header" style={s.textHeading}>
                  {item.label}
                </Text>
                <Text style={s.detail}>{item.detail}</Text>
                <Text style={s.source}>Source: {sourceLabel(map, item)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            {selected === "governor" ? (
              <OfficeDiagram
                map={map}
                selected={selectedNode}
                select={selectNode}
                stacked={width < 370 || fontScale > 1.15}
              />
            ) : (
              <MeasureDiagram
                map={map}
                selected={selectedNode}
                select={selectNode}
                stacked={width < 370 || fontScale > 1.15}
              />
            )}
            {activeNode && (
              <View style={s.disclosure}>
                <Text style={s.disclosureTitle}>{activeNode.label}</Text>
                <Text style={s.detail}>{activeNode.detail}</Text>
                <Text style={s.source}>
                  Source: {sourceLabel(map, activeNode)}
                </Text>
              </View>
            )}
          </>
        )}
        <View style={s.note}>
          <Icon name="info" size={16} color={P.quiet} />
          <View style={s.noteContent}>
            <Text accessibilityRole="header" style={s.noteTitle}>
              What this does not promise
            </Text>
            <Text style={s.noteBody}>{map.caveat}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={s.sourcesTitle}>
          Official sources
        </Text>
        {map.sources.map((source) => (
          <SourceLink key={source.id} label={source.label} url={source.url} />
        ))}
        <Text style={s.footer}>
          Reviewed example for California’s November 2026 election. Formal rules
          do not predict an outcome.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 70,
    gap: 12,
  },
  eyebrow: {
    color: P.quiet,
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  title: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 29,
    lineHeight: 35,
  },
  takeaway: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 11,
    backgroundColor: P.stone,
    borderWidth: 1,
    borderColor: P.border,
    marginTop: 2,
  },
  mode: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  activeMode: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.primary,
  },
  modeText: { color: P.quiet, fontFamily: fontBody.semibold, fontSize: 13 },
  activeModeText: { color: P.inkOnNight },
  sectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  sectionTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    flexShrink: 1,
  },
  sectionMeta: {
    color: P.quiet,
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  origin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    backgroundColor: P.card,
  },
  iconTile: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.surface,
    borderRadius: 8,
  },
  originText: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 16,
  },
  originMeta: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 11 },
  connector: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  connectorLine: { height: 12, width: 1, backgroundColor: P.primary },
  connectorLabel: {
    color: P.quiet,
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  diagram: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  officeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  columnHead: {
    width: "45%",
    color: P.quiet,
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 0.7,
  },
  stackedColumnHead: { width: "100%" },
  lane: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 73,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  laneStacked: { flexDirection: "column", alignItems: "stretch", gap: 4 },
  laneBorder: { borderTopWidth: 1, borderTopColor: P.border },
  laneSide: { flex: 1, minHeight: 44, justifyContent: "center" },
  laneAction: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 15,
    lineHeight: 19,
  },
  laneLimit: {
    color: P.inkOnNight,
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  diagramHint: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 7,
  },
  point: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    padding: 13,
    minHeight: 82,
  },
  pointActive: { borderColor: P.primary },
  pointKind: {
    color: P.primary,
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  pointTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    marginTop: 4,
  },
  pointNote: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  branches: { flexDirection: "row", gap: 10 },
  branchesStacked: { flexDirection: "column" },
  branch: { flex: 1 },
  branchTail: {
    marginLeft: 12,
    paddingLeft: 13,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: P.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  tailTitle: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 12,
  },
  tailNote: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  disclosure: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.primary,
    borderRadius: 12,
    padding: 14,
    gap: 7,
  },
  disclosureTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 16,
  },
  detail: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  source: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  textCard: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  textItem: { gap: 6, paddingVertical: 13 },
  textItemBorder: { borderTopWidth: 1, borderTopColor: P.border },
  textHeading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 16,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    backgroundColor: P.card,
  },
  noteContent: { flex: 1, gap: 4 },
  noteTitle: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 13,
  },
  noteBody: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  sourcesTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    marginTop: 4,
  },
  footer: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
});
