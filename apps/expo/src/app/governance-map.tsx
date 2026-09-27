import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { GovernanceExample, GovernanceNode } from "~/utils/governance-map";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { GovernanceScene } from "~/components/GovernanceScene";
import { NavHeader } from "~/components/ui";
import { Icon } from "~/components/ui/Icon";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { governanceMaps } from "~/utils/governance-map";

const STAGES = {
  governor: [
    { label: "Ballots", y: 0 },
    { label: "Office", y: 410 },
    { label: "Checks", y: 900 },
  ],
  "prop-4-2026": [
    { label: "Ballots", y: 0 },
    { label: "Result", y: 420 },
    { label: "Later choice", y: 765 },
  ],
} as const;

export default function GovernanceMapScreen() {
  const router = useRouter();
  const { example, view, stage } = useLocalSearchParams<{
    example?: string;
    view?: string;
    stage?: string;
  }>();
  const selected: GovernanceExample =
    example === "prop-4-2026" ? "prop-4-2026" : "governor";
  const map = governanceMaps[selected];
  const { width, fontScale } = useWindowDimensions();
  const textRequired = width < 370 || fontScale >= 1.3;
  const [modeState, setModeState] = useState({
    view,
    textMode: view === "text",
  });
  const textMode =
    textRequired ||
    (modeState.view === view ? modeState.textMode : view === "text");
  const initialStage = stage === "3" ? 2 : stage === "2" ? 1 : 0;
  const [activeStage, setActiveStage] = useState(initialStage);
  const [activeNode, setActiveNode] = useState<GovernanceNode | null>(null);
  const scroll = useRef<ScrollView>(null);
  const artTop = useRef(0);
  const didInitialScroll = useRef(false);
  const stages = STAGES[selected];
  const scale = width / 393;
  const labels = Object.fromEntries(
    map.nodes.map((item) => [item.id, item.label]),
  );
  const source = activeNode
    ? map.sources.find((item) => item.id === activeNode.source)
    : undefined;

  useEffect(() => {
    if (textMode) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (!artTop.current) return;
    requestAnimationFrame(() => {
      setActiveStage(initialStage);
      scroll.current?.scrollTo({
        y:
          initialStage === 0
            ? 0
            : artTop.current + stages[initialStage].y * scale - 20,
        animated: false,
      });
    });
  }, [stage, selected, width, textMode, initialStage, scale, stages]);

  function goToStage(index: number) {
    setActiveStage(index);
    scroll.current?.scrollTo({
      y:
        index === 0 ? 0 : artTop.current + (stages[index]?.y ?? 0) * scale - 20,
      animated: false,
    });
  }

  return (
    <View style={s.screen}>
      <NavHeader
        title="How this vote works"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView
        ref={scroll}
        scrollEventThrottle={32}
        onScroll={(event) => {
          if (textMode) return;
          const y = event.nativeEvent.contentOffset.y - artTop.current;
          const next =
            y >= stages[2].y * scale - 160
              ? 2
              : y >= stages[1].y * scale - 140
                ? 1
                : 0;
          setActiveStage((current) => (current === next ? current : next));
        }}
        contentContainerStyle={s.content}
      >
        <View style={s.intro}>
          <Text style={s.eyebrow}>{map.eyebrow}</Text>
          <Text accessibilityRole="header" style={s.title}>
            {map.title}
          </Text>
          <Text style={s.subtitle}>{map.takeaway}</Text>
          <View style={s.modeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected: !textMode,
                disabled: textRequired,
              }}
              disabled={textRequired}
              onPress={() => setModeState({ view, textMode: false })}
              style={[s.mode, !textMode && s.modeActive]}
            >
              <Text style={[s.modeLabel, !textMode && s.modeLabelActive]}>
                Visual map
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: textMode }}
              onPress={() => setModeState({ view, textMode: true })}
              style={[s.mode, textMode && s.modeActive]}
            >
              <Text style={[s.modeLabel, textMode && s.modeLabelActive]}>
                Text version
              </Text>
            </Pressable>
          </View>
          {!textMode && (
            <Text style={s.tapHint}>
              Tap a landmark to read its rule and official source.
            </Text>
          )}
          {textRequired && (
            <Text style={s.adaptiveNote}>
              Text version is shown at this display size for legibility.
            </Text>
          )}
        </View>
        {textMode ? (
          <View style={s.textVersion}>
            <Text style={s.textIntro}>
              Each step names its official source. These are conditional rules,
              not a prediction.
            </Text>
            {map.nodes.map((item, index) => (
              <View
                key={item.id}
                style={[s.textItem, index > 0 && s.textBorder]}
              >
                <Text accessibilityRole="header" style={s.textHeading}>
                  {item.label}
                </Text>
                <Text style={s.textBody}>{item.detail}</Text>
                <Text style={s.attribution}>
                  Source:{" "}
                  {map.sources.find((entry) => entry.id === item.source)?.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View
              onLayout={(event) => {
                artTop.current = event.nativeEvent.layout.y;
                if (initialStage > 0 && !didInitialScroll.current) {
                  didInitialScroll.current = true;
                  requestAnimationFrame(() => goToStage(initialStage));
                }
              }}
            >
              <GovernanceScene
                example={selected}
                width={width}
                activeStage={activeStage}
                accessibilityLabels={labels}
                onSelect={(id) =>
                  setActiveNode(
                    map.nodes.find((item) => item.id === id) ?? null,
                  )
                }
              />
            </View>
            <View style={s.mapEnd}>
              <Icon name="info" size={16} color={P.quiet} />
              <Text style={s.limit}>{map.caveat}</Text>
            </View>
          </>
        )}
        <View style={s.sources}>
          <Text accessibilityRole="header" style={s.sourcesHeading}>
            Official sources
          </Text>
          {map.sources.map((item) => (
            <SourceLink key={item.id} label={item.label} url={item.url} />
          ))}
          <Text style={s.footer}>
            Reviewed California 2026 teaching example. Formal rules do not
            predict the result.
          </Text>
        </View>
      </ScrollView>
      {!textMode && (
        <View style={s.stageDock} accessibilityLabel="Map stages">
          {stages.map((item, index) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={`Stage ${index + 1}: ${item.label}`}
              accessibilityState={{ selected: activeStage === index }}
              onPress={() => goToStage(index)}
              style={[
                s.stageButton,
                activeStage === index && s.stageButtonActive,
              ]}
            >
              <Text
                style={[
                  s.stageNumber,
                  activeStage === index && s.stageNumberActive,
                ]}
              >
                {index + 1}
              </Text>
              <Text
                style={[
                  s.stageLabel,
                  activeStage === index && s.stageLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={Boolean(activeNode)}
        transparent
        animationType="none"
        onRequestClose={() => setActiveNode(null)}
      >
        <View style={s.modalShade}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessible={false}
            onPress={() => setActiveNode(null)}
          />
          <View style={s.detailSheet}>
            <View style={s.detailTop}>
              <Text style={s.detailKicker}>
                OFFICIAL RULE · TAP POINT ON MAP
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close detail"
                onPress={() => setActiveNode(null)}
                style={s.closeButton}
              >
                <Icon name="close" size={19} color={P.inkOnNight} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.detailContents}>
              <Text accessibilityRole="header" style={s.detailTitle}>
                {activeNode?.label}
              </Text>
              <Text style={s.detailBody}>{activeNode?.detail}</Text>
              {source && <SourceLink label={source.label} url={source.url} />}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { paddingBottom: 32 },
  intro: { paddingHorizontal: 20, paddingTop: 14, gap: 8 },
  eyebrow: {
    color: P.quiet,
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  title: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 2 },
  mode: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: hair[2],
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  modeActive: { borderBottomWidth: 3, borderBottomColor: P.primary },
  modeLabel: { color: P.quiet, fontFamily: fontBody.semibold, fontSize: 13 },
  modeLabelActive: { color: P.inkOnNight },
  adaptiveNote: { color: P.quiet, fontFamily: fontBody.regular, fontSize: 12 },
  tapHint: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  mapEnd: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 12,
    gap: 10,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: hair[2],
    backgroundColor: planes.slate,
  },
  limit: {
    flex: 1,
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  sources: { paddingHorizontal: 20, gap: 8, paddingBottom: 18 },
  sourcesHeading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    marginBottom: 4,
  },
  footer: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  textVersion: {
    marginHorizontal: 20,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    paddingHorizontal: 15,
    marginTop: 18,
  },
  textIntro: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 14,
    paddingBottom: 8,
  },
  textItem: { paddingVertical: 15, gap: 6 },
  textBorder: { borderTopWidth: 1, borderTopColor: hair[2] },
  textHeading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 16,
  },
  textBody: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  attribution: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  stageDock: {
    flexDirection: "row",
    backgroundColor: planes.slate,
    borderTopWidth: 1,
    borderTopColor: hair[2],
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: 8,
  },
  stageButton: {
    flex: 1,
    minHeight: 45,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  stageButtonActive: { borderTopWidth: 2, borderTopColor: P.primary },
  stageNumber: { color: P.quiet, fontFamily: fontBody.bold, fontSize: 11 },
  stageNumberActive: { color: P.primary },
  stageLabel: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 12 },
  stageLabelActive: { color: P.inkOnNight },
  modalShade: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  detailSheet: {
    maxHeight: "85%",
    backgroundColor: planes.slate,
    borderTopWidth: 1,
    borderTopColor: hair[3],
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  detailContents: { gap: 11, paddingBottom: 28 },
  detailTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailKicker: {
    color: P.quiet,
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 21,
  },
  detailBody: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
});
