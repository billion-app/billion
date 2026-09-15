import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card } from "~/components/ui/layout";
import {
  DigestHair,
  DigestRadii,
  fontBody,
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
}: {
  title: string;
  text?: string;
  label?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      {label}
      {text && <BallotReadingText text={text} />}
      {children}
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: P.card,
    borderColor: DigestHair.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DigestRadii.menu,
    padding: sp[4],
    gap: sp[3],
  },
  heading: { fontFamily: fontBody.semibold, fontSize: 18, color: P.inkOnNight },
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
    color: P.inkOnNight,
  },
});
