/**
 * Screen header with optional large title.
 */
import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageButton } from "~/components/LanguageButton";
import { useLanguage } from "~/hooks/useLanguage";
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
  languageControl = true,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  large?: boolean;
  tone?: "dark" | "paper";
  languageControl?: boolean;
}) {
  const { t: tr } = useLanguage();
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const separateTitle = fontScale > 1.2 || width < 390 || !!action;
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
        {!large && !separateTitle && (
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
            accessibilityLabel={tr("common.goBack")}
          >
            <Icon name="chevL" size={18} color={foreground} />
          </TouchableOpacity>
        ) : (
          <View style={s.spacer} />
        )}
        <View style={s.action}>
          {languageControl && <LanguageButton compact tone={tone} />}
          {action}
        </View>
      </View>
      {!large && separateTitle && (
        <Text
          key={fontScale}
          accessibilityRole="header"
          style={[
            s.title,
            {
              position: "relative",
              left: 0,
              right: 0,
              marginTop: 8,
              marginHorizontal: 12,
              color: foreground,
            },
          ]}
        >
          {title}
        </Text>
      )}
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
    width: 44,
    height: 44,
    borderRadius: DigestRadii.menuRow,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { width: 36 },
  title: {
    position: "absolute",
    left: 84,
    right: 84,
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
