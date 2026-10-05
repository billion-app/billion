import { useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CandidateBrief } from "@acme/validators";

import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { fontEditorial, hair, DigestPalette as P, planes } from "~/styles";
import { focusControl, s, Segments } from "./ResearchUI";

export interface EvidenceSelection {
  ids: string[];
  title: string;
  restoreFocus?: () => void;
}
export function EvidenceSheet({
  selection,
  evidence,
  onClose,
  fictional,
}: {
  selection: EvidenceSelection;
  evidence: CandidateBrief["evidence"];
  onClose: () => void;
  fictional: boolean;
}) {
  const [index, setIndex] = useState("0");
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.4;
  const done = useRef<View>(null);
  const sources = selection.ids.flatMap((id) =>
    evidence.filter((e) => e.id === id),
  );
  const source = sources[Number(index)];
  const dismiss = () => {
    onClose();
    requestAnimationFrame(() => selection.restoreFocus?.());
  };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      gesture.dy > 12 && Math.abs(gesture.dx) < 30,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 45) dismiss();
    },
  });
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={dismiss}
      onShow={() => focusControl(done.current)}
      onDismiss={() => selection.restoreFocus?.()}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          onPress={dismiss}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              marginTop: insets.top + 16,
            },
          ]}
        >
          <View
            {...pan.panHandlers}
            style={styles.handleArea}
            accessible={false}
          >
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[largeText ? s.label : s.heading, { flex: 1 }]}
            >
              {largeText ? "Source" : selection.title}
            </Text>
            <Pressable
              ref={done}
              accessibilityRole="button"
              onPress={dismiss}
              style={styles.done}
            >
              <Text style={s.link}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {largeText && (
              <Text accessibilityRole="header" style={s.heading}>
                {selection.title}
              </Text>
            )}
            {sources.length > 1 && (
              <Segments
                options={sources.map((_, i) => ({
                  value: String(i),
                  label: `Source ${i + 1}`,
                }))}
                value={index}
                onChange={setIndex}
              />
            )}
            {source ? (
              <>
                <Text style={s.eyebrow}>
                  {source.origin === "candidate"
                    ? "CANDIDATE'S OWN WORDS"
                    : source.origin === "primary_record"
                      ? "ORIGINAL RECORD"
                      : "INDEPENDENT REPORTING"}
                  {fictional ? " · FICTIONAL" : ""}
                </Text>
                <Text accessibilityRole="header" style={s.heading}>
                  {source.title ?? source.publisher}
                </Text>
                <Text style={s.muted}>
                  {source.publisher} · {source.locator}
                </Text>
                <View style={styles.quote}>
                  <Text selectable style={styles.quoteText}>
                    {source.excerpt}
                  </Text>
                </View>
                {source.shows && (
                  <View style={s.point}>
                    <Text style={s.label}>What it shows</Text>
                    <Text style={s.body}>{source.shows}</Text>
                  </View>
                )}
                {source.limits && (
                  <View style={s.point}>
                    <Text style={s.label}>What it doesn’t</Text>
                    <Text style={s.body}>{source.limits}</Text>
                  </View>
                )}
                <View style={s.rule}>
                  {fictional ? (
                    <Text selectable style={s.muted}>
                      {source.url} · example URL
                    </Text>
                  ) : (
                    <SourceLink label={source.url} url={source.url} />
                  )}
                  <Text style={s.muted}>
                    Retrieved{" "}
                    {new Date(source.retrievedAt).toLocaleDateString("en-US", {
                      timeZone: "UTC",
                    })}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={s.body}>
                This source is unavailable. Please return to the candidate and
                try again.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.6)",
  },
  sheet: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[3],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handleArea: { minHeight: 26, alignItems: "center", justifyContent: "center" },
  handle: { width: 34, height: 4, borderRadius: 4, backgroundColor: P.quiet },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: hair[3],
  },
  done: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  body: { padding: 18, gap: 16 },
  quote: {
    backgroundColor: planes.ink,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 2,
    borderColor: P.primary,
  },
  quoteText: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.italic,
    fontSize: 18,
    lineHeight: 27,
  },
});
