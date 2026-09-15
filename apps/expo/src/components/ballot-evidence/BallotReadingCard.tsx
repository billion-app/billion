import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { IconName } from "~/components/ui/Icon";
import { Icon } from "~/components/ui/Icon";
import { Segmented } from "~/components/ui/Segmented";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { BallotText as Text } from "./BallotText";

/** Preserve supplied prose verbatim; long text can be opened in place. */
export function BallotReadingText({
  text,
  source = false,
}: {
  text: string;
  source?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 600;
  return (
    <View style={{ gap: 8 }}>
      <Text
        selectable
        style={[s.body, source && s.sourceText]}
        numberOfLines={long && !expanded ? 7 : undefined}
      >
        {text}
      </Text>
      {long && (
        <ReadingToggle
          expanded={expanded}
          onPress={() => setExpanded(!expanded)}
        />
      )}
    </View>
  );
}

function ReadingToggle({
  expanded,
  onPress,
  extended = false,
}: {
  expanded: boolean;
  onPress: () => void;
  extended?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={s.action}
    >
      <Text style={s.actionText}>
        {expanded
          ? "Show less"
          : extended
            ? "Read extended summary"
            : "Read full text"}
      </Text>
      <Icon name={expanded ? "chevD" : "chevR"} size={14} color={P.primary} />
    </Pressable>
  );
}

/** The article's summary / context / source hierarchy, using only supplied fields. */
export function BallotReadingCard({
  title,
  text,
  extendedText,
  label,
  children,
  inset = false,
  icon = "doc",
  accent = false,
}: {
  title: string;
  text?: string;
  extendedText?: string;
  label?: ReactNode;
  children?: ReactNode;
  inset?: boolean;
  icon?: IconName;
  accent?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExtended = !!extendedText && extendedText !== text;
  return (
    <>
      {label}
      <View style={[s.card, !inset && s.source, accent && s.accent]}>
        <View style={s.header}>
          <View style={[s.icon, accent && s.accentIcon]}>
            <Icon
              name={icon}
              size={16}
              color={accent ? P.primary : P.inkOnNight}
            />
          </View>
          <Text accessibilityRole="header" style={s.heading}>
            {title}
          </Text>
        </View>
        {text &&
          (hasExtended ? (
            <BallotReadingText text={text} />
          ) : (
            <BallotReadingText text={text} source={!inset} />
          ))}
        {hasExtended && (
          <ReadingToggle
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
            extended
          />
        )}
        {hasExtended && expanded && (
          <View style={s.extended}>
            <Text style={s.kicker}>EXTENDED SUMMARY</Text>
            <BallotReadingText text={extendedText} />
          </View>
        )}
        {children}
      </View>
    </>
  );
}

export function BallotAiDisclosure({
  label = "AI summary",
}: {
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.provenance}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.provenanceRow}
      >
        <Icon name="sparkle" size={17} color={P.primary} />
        <Text style={s.provenanceText}>{label} · Check the source</Text>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={14}
          color={P.inkOnNight}
        />
      </Pressable>
      {expanded && (
        <Text style={s.provenanceDetail}>
          This is an AI-generated explanation, not the original source text.
          Compare it with the original and the sources below.
        </Text>
      )}
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
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={options.map((option, index) => ({
        id: option.value,
        label: option.label,
        icon: index === 0 ? "book" : "doc",
      }))}
    />
  );
}

export function BallotBiography({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.contextHeader}
      >
        <View style={s.icon}>
          <Icon name="user" size={16} color={P.inkOnNight} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heading}>About the candidate</Text>
          <Text style={s.contextHint}>Biography</Text>
        </View>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={P.inkOnNight}
        />
      </Pressable>
      {expanded && <BallotReadingText text={text} />}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: planes.slate,
    borderColor: hair[1],
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 13,
  },
  source: { backgroundColor: planes.ink, borderColor: hair[2], padding: 18 },
  accent: { borderLeftWidth: 3, borderLeftColor: P.primary },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  accentIcon: { backgroundColor: `${P.primary}28` },
  heading: {
    flex: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  sourceText: { lineHeight: 25, color: "rgba(255,255,255,0.82)" },
  action: {
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: P.canvas,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.primary,
  },
  extended: {
    borderTopWidth: 1,
    borderTopColor: hair[2],
    paddingTop: 13,
    gap: 8,
  },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: P.inkOnNight,
  },
  provenance: {
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  provenanceRow: {
    minHeight: 44,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  provenanceText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: P.inkOnNight,
  },
  provenanceDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
    paddingBottom: 12,
  },
  contextHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 9,
  },
  contextHint: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: P.inkOnNight,
    opacity: 0.7,
  },
});
