import type { ReactNode } from "react";
import { useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import type { ResearchPoint } from "@acme/validators";

import type { InlineDefinition } from "~/components/ui/DefinedText";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui";
import { DefinedText } from "~/components/ui/DefinedText";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";

export type EvidenceOpener = (
  ids: string[],
  title: string,
  restoreFocus?: () => void,
) => void;
export function focusControl(control: View | null) {
  if (!control) return;
  if (Platform.OS === "web") {
    (control as unknown as { focus?: () => void }).focus?.();
    return;
  }
  const handle = findNodeHandle(control);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
}
export function Action({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        !secondary && s.actionFilled,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={s.link}>{label}</Text>
      <Icon name="chevR" size={18} color={P.primary} />
    </Pressable>
  );
}
export function EvidenceAction({
  ids,
  title,
  label = "Evidence & context",
  open,
}: {
  ids: string[];
  title: string;
  label?: string;
  open: EvidenceOpener;
}) {
  const ref = useRef<View>(null);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${title}`}
      onPress={() => open(ids, title, () => focusControl(ref.current))}
      style={s.action}
    >
      <Text style={s.link}>{label}</Text>
      <Icon name="chevR" size={17} color={P.primary} />
    </Pressable>
  );
}
export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={s.panel}>
      {title && (
        <Text accessibilityRole="header" style={s.heading}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Emphasis({
  text,
  phrases = [],
  terms,
}: {
  text: string;
  phrases?: string[];
  terms?: readonly InlineDefinition[];
}) {
  return (
    <DefinedText text={text} emphasis={phrases} terms={terms} style={s.body} />
  );
}
export function Point({
  point,
  open,
  terms,
}: {
  point: ResearchPoint;
  terms?: readonly InlineDefinition[];
  open: EvidenceOpener;
}) {
  return (
    <View style={s.point}>
      <Text accessibilityRole="header" style={s.label}>
        {point.title}
      </Text>
      <Emphasis text={point.text} phrases={point.emphasis} terms={terms} />
      <EvidenceAction ids={point.evidenceIds} title={point.title} open={open} />
    </View>
  );
}
export function Segments<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
}: {
  scrollable?: boolean;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const choices = options.map((option) => (
    <Pressable
      key={option.value}
      accessibilityRole="tab"
      aria-selected={value === option.value}
      accessibilityState={{ selected: value === option.value }}
      onPress={() => onChange(option.value)}
      style={[
        s.segment,
        scrollable && { flexBasis: "auto", flexGrow: 0, paddingHorizontal: 16 },
        value === option.value && s.selected,
      ]}
    >
      <Text style={[s.segmentText, value === option.value && s.selectedText]}>
        {option.label}
      </Text>
    </Pressable>
  ));
  return scrollable ? (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      showsHorizontalScrollIndicator
      contentContainerStyle={{ gap: 4 }}
      style={{ backgroundColor: planes.slate, borderRadius: 14, padding: 4 }}
    >
      {choices}
    </ScrollView>
  ) : (
    <View accessibilityRole="tablist" style={s.segments}>
      {choices}
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    padding: 18,
    paddingBottom: 60,
    gap: 18,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },
  panel: {
    backgroundColor: planes.slate,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[3],
    padding: 16,
    gap: 14,
  },
  heading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 23,
    lineHeight: 29,
  },
  title: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 37,
  },
  body: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  muted: {
    color: "#BDC1CD",
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 23,
  },
  eyebrow: {
    color: "#BDC1CD",
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.2,
  },
  emphasis: { fontFamily: fontBody.bold },
  action: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
  },
  actionFilled: {
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hair[3],
    backgroundColor: planes.surface,
  },
  link: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  grow: { flex: 1, gap: 7 },
  tile: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.surface,
    borderRadius: 10,
  },
  rule: { borderTopWidth: 1, borderTopColor: hair[3], paddingTop: 16, gap: 10 },
  point: { gap: 7 },
  segments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[3],
    borderRadius: 14,
    padding: 4,
  },
  segment: {
    minHeight: 44,
    flexGrow: 1,
    flexBasis: 80,
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentText: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  selected: { backgroundColor: P.primary },
  selectedText: { color: planes.ink },
});
