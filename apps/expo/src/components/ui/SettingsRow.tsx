/**
 * SettingsRow — airy Cash App–grade line: mark, label, quiet chevron.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { IconName } from "./Icon";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";
import { Icon } from "./Icon";

export function SettingsRow({
  icon,
  label,
  sub,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const fg = danger ? P.quiet : P.inkOnNight;
  return (
    <TouchableOpacity
      style={[s.row, !last && s.divider]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      <View style={s.mark}>
        <Icon name={icon} size={18} color={danger ? P.quiet : P.spark} />
      </View>
      <View style={s.body}>
        <Text style={[s.label, { color: fg }]}>{label}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      <Icon name="chevR" size={15} color={P.quiet} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DigestHair.tabActivePill,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 16,
    color: P.quiet,
  },
});
