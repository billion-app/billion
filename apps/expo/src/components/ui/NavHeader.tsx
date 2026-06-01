/** NavHeader — back circle / title / action; `large` shows a display title. */
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontDisplay, hair, planes } from "~/styles";
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
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 4 }]}>
      <View style={s.row}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={s.backBtn}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Icon name="chevL" size={20} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={s.spacer} />
        )}
        {!large && <Text style={s.title}>{title}</Text>}
        <View style={s.action}>{action}</View>
      </View>
      {large && <Text style={s.large}>{title}</Text>}
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
    fontFamily: "AlbertSans-SemiBold",
    fontSize: 17,
    color: colors.white,
  },
  action: { width: 40, alignItems: "flex-end" },
  large: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    color: colors.white,
    marginTop: 10,
    lineHeight: 36,
  },
});
