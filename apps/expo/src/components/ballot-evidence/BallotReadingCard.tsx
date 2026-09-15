import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import {
  DigestHair,
  DigestRadii,
  fontBody,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";
import { BallotText as Text } from "./BallotText";

/** Preserve supplied prose verbatim; long text can be opened in place. */
export function BallotReadingText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 600;
  return (
    <View style={{ gap: sp[2] }}>
      <Text style={s.body} numberOfLines={long && !expanded ? 7 : undefined}>
        {text}
      </Text>
      {long && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={s.action}
        >
          <Text style={s.actionText}>
            {expanded ? "Show less" : "Read full text"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function BallotReadingCard({
  title,
  text,
  label,
  children,
  inset = false,
}: {
  title: string;
  text?: string;
  label?: ReactNode;
  children?: ReactNode;
  inset?: boolean;
}) {
  return (
    <View style={inset ? s.card : s.section}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      {label}
      {text && <BallotReadingText text={text} />}
      {children}
    </View>
  );
}

export function BallotReadingMode<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[s.modes, fontScale > 1.3 && { flexDirection: "column" }]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[s.mode, value === option.value && s.selected]}
        >
          <Text
            style={[s.modeText, value === option.value && { color: P.canvas }]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: sp[3] },
  modes: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    backgroundColor: P.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  mode: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 44,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  selected: { backgroundColor: P.inkOnNight },
  modeText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: P.inkOnNight,
  },
  card: {
    backgroundColor: P.card,
    borderColor: DigestHair.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DigestRadii.menu,
    padding: sp[4],
    gap: sp[3],
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  actionText: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.primary,
  },
});
