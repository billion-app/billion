/** NavHeader — back circle / title / action; `large` shows a display title. */
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontDisplay, hair, planes, useTheme } from "~/styles";
import { Icon } from "./Icon";

export function NavHeader({
  title,
  onBack,
  action,
  large,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  large?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 4 }]}>
      <View style={s.row}>
        {/* Centred against the header rather than against the gap between the
            two side slots, so a screen with two actions does not push its
            title off-centre. Behind the buttons in the layout, and inert, so
            a long title cannot swallow a tap. */}
        {!large && (
          <Text
            style={[s.title, { color: theme.foreground }]}
            numberOfLines={1}
            pointerEvents="none"
          >
            {title}
          </Text>
        )}
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={s.backBtn}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Icon name="chevL" size={20} color={theme.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={s.spacer} />
        )}
        <View style={s.action}>{action}</View>
      </View>
      {large && (
        <Text style={[s.large, { color: theme.foreground }]}>{title}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },
  backBtn: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { width: 40 },
  title: {
    position: "absolute",
    left: 48,
    right: 48,
    textAlign: "center",
    fontFamily: "AlbertSans-SemiBold",
    fontSize: 17,
    color: colors.white,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    minWidth: 40,
  },
  large: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    color: colors.white,
    marginTop: 10,
    lineHeight: 36,
  },
});
