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

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui";
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
}: {
  text: string;
  phrases?: string[];
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  // Only exact editorial phrases; never interpret source text as markup.
  while (cursor < text.length) {
    const matches = phrases
      .flatMap((phrase) => {
        const index = text.indexOf(phrase, cursor);
        return index < 0 ? [] : [{ index, phrase }];
      })
      .sort((a, b) => a.index - b.index || b.phrase.length - a.phrase.length);
    const match = matches[0];
    if (!match) {
      parts.push(text.slice(cursor));
      break;
    }
    parts.push(text.slice(cursor, match.index));
    parts.push(
      <Text key={match.index} style={s.emphasis}>
        {match.phrase}
      </Text>,
    );
    cursor = match.index + match.phrase.length;
  }
  return (
    <Text selectable style={s.body}>
      {parts}
    </Text>
  );
}
export function Point({
  point,
  open,
}: {
  point: ResearchPoint;
  open: EvidenceOpener;
}) {
  return (
    <View style={s.point}>
      <Text accessibilityRole="header" style={s.label}>
        {point.title}
      </Text>
      <Emphasis text={point.text} phrases={point.emphasis} />
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
