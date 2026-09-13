/**
 * Screen header with optional large title.
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { Icon } from "./Icon";

export function NavHeader({
  title,
  onBack,
  action,
  large,
  tone = "dark",
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  large?: boolean;
  tone?: "dark" | "paper";
}) {
  const insets = useSafeAreaInsets();
  const paper = tone === "paper";
  const foreground = paper ? P.ink : P.inkOnNight;
  const backBg = paper ? DigestHair.inkFaint : P.stone;
  const backBorder = paper ? DigestHair.inkBorder : DigestHair.cardBorder;
  const rule = paper ? DigestHair.inkHair : DigestHair.sectionRule;

  return (
    <View
      style={[
        s.wrap,
        paper ? s.paperWrap : s.darkWrap,
        { paddingTop: insets.top + 4 },
      ]}
    >
      <View style={s.row}>
        {/* Centred against the header rather than against the gap between the
            two side slots, so a screen with two actions does not push its
            title off-centre. Behind the buttons in the layout, and inert, so
            a long title cannot swallow a tap. */}
        {!large && (
          <Text
            style={[s.title, { color: foreground }]}
            numberOfLines={1}
            pointerEvents="none"
          >
            {title}
          </Text>
        )}
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[
              s.backBtn,
              { backgroundColor: backBg, borderColor: backBorder },
            ]}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon name="chevL" size={18} color={foreground} />
          </TouchableOpacity>
        ) : (
          <View style={s.spacer} />
        )}
        <View style={s.action}>{action}</View>
      </View>
      {large && <Text style={[s.large, { color: foreground }]}>{title}</Text>}
      <View style={[s.bottomRule, { backgroundColor: rule }]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingBottom: 12,
  },
  darkWrap: { backgroundColor: P.canvas },
  paperWrap: { backgroundColor: P.paper },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },
  backBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    width: 36,
    height: 36,
    borderRadius: DigestRadii.menuRow,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { width: 36 },
  title: {
    position: "absolute",
    left: 48,
    right: 48,
    textAlign: "center",
    fontFamily: fontBody.semibold,
    fontSize: 16,
    letterSpacing: -0.15,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    minWidth: 36,
  },
  large: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    marginTop: 12,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  bottomRule: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
