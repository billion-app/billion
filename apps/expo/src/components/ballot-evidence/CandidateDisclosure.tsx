import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";

export function CandidateDisclosure({
  title,
  children,
  initiallyOpen = false,
  label,
  summary,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
  label?: string;
  summary?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View
      style={{
        gap: sp[2],
        backgroundColor: planes.slate,
        borderWidth: 1,
        borderColor: hair[1],
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: sp[3],
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              flex: 1,
              color: P.inkOnNight,
              fontFamily: fontEditorial.bold,
              fontSize: 16,
              lineHeight: 21,
            }}
          >
            {title}
          </Text>
        </View>
        <Icon name={open ? "chevD" : "chevR"} size={14} color={colors.bill} />
      </Pressable>
      {summary && (
        <Text
          style={{
            fontFamily: fontBody.regular,
            fontSize: 12.5,
            lineHeight: 18,
            color: "rgba(255,255,255,0.70)",
          }}
        >
          {summary}
        </Text>
      )}
      {open ? <View style={{ gap: sp[3] }}>{children}</View> : null}
    </View>
  );
}
export const candidateDetailText = {
  color: P.inkOnNight,
  fontFamily: fontBody.regular,
  fontSize: 14,
  lineHeight: 22,
} as const;

// Candidate sources use the shared Bills-aligned evidence action.
export { SourceLink as CandidateSourceLink } from "./BallotEvidence";
