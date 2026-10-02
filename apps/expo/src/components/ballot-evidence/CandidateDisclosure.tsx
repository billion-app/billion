import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { fontBody, DigestPalette as P, sp } from "~/styles";

export function CandidateDisclosure({
  title,
  children,
  initiallyOpen = false,
  label,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ gap: sp[2] }}>
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
              fontFamily: fontBody.semibold,
              fontSize: 14,
            }}
          >
            {title}
          </Text>
        </View>
        <Icon name={open ? "chevD" : "chevR"} size={16} color={P.inkOnNight} />
      </Pressable>
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
