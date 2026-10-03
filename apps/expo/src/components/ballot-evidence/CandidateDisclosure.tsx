import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { fontBody, hair, DigestPalette as P, planes, sp } from "~/styles";
import { webUrl } from "./model";

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
    <View style={{ gap: sp[2], borderTopWidth: 1, borderTopColor: hair[1] }}>
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
          gap: 7,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              flex: 1,
              color: P.inkOnNight,
              opacity: 0.78,
              fontFamily: fontBody.medium,
              fontSize: 11.5,
            }}
          >
            {title}
          </Text>
        </View>
        <Icon name={open ? "chevD" : "chevR"} size={13} color={P.inkOnNight} />
      </Pressable>
      {open ? <View style={{ gap: sp[3] }}>{children}</View> : null}
    </View>
  );
}
export const candidateDetailText = {
  color: P.inkOnNight,
  fontFamily: fontBody.regular,
  fontSize: 13.5,
  lineHeight: 20,
} as const;

/** Candidate-local source actions follow BillBrief's compact source convention. */
export function CandidateSourceLink({
  label,
  url,
  prominence = "secondary",
}: {
  label: string;
  url?: string;
  prominence?: "primary" | "secondary";
}) {
  const [failed, setFailed] = useState(false);
  const href = webUrl(url);
  if (!href)
    return <Text style={candidateDetailText}>{label} · Link unavailable</Text>;
  const primary = prominence === "primary";
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={() => {
          void Linking.openURL(href).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingHorizontal: 13,
          borderRadius: primary ? 14 : 999,
          borderWidth: primary ? 0 : 1,
          borderColor: hair[2],
          backgroundColor: primary ? planes.paper : planes.surface,
          alignSelf: primary ? "stretch" : "flex-start",
          justifyContent: primary ? "center" : undefined,
        }}
      >
        <Text
          style={{
            flexShrink: 1,
            fontFamily: fontBody.semibold,
            fontSize: 11.5,
            color: primary ? P.ink : P.inkOnNight,
          }}
        >
          {label}
        </Text>
        <Icon
          name="external"
          size={13}
          color={primary ? P.ink : P.inkOnNight}
        />
      </Pressable>
      {failed ? (
        <Text accessibilityRole="alert" style={candidateDetailText}>
          Could not open the link. Tap to retry.
        </Text>
      ) : null}
    </View>
  );
}
