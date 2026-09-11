/**
 * SettingsRow — dense editorial settings line.
 * Icon tile + label + optional subtitle + quiet chevron; hairline dividers.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { IconName } from "./Icon";
import {
  colors,
  fontBody,
  DigestHair,
  DigestPalette as P,
  DigestRadii,
} from "~/styles";
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
  const fg = danger ? colors.red[500] : P.inkOnNight;
  const tileIcon = danger ? colors.red[500] : P.spark;
  return (
    <TouchableOpacity
      style={[s.row, !last && s.divider]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      <View style={[s.tile, danger && s.tileDanger]}>
        <Icon name={icon} size={17} color={tileIcon} />
      </View>
      <View style={s.body}>
        <Text style={[s.label, { color: fg }]}>{label}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      <Icon name="chevR" size={16} color={P.quiet} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  tile: {
    width: 34,
    height: 34,
    borderRadius: DigestRadii.menuRow,
    backgroundColor: DigestHair.menuRowOn,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.menuBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  tileDanger: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.28)",
  },
  body: { flex: 1, gap: 2 },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  sub: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 16,
    color: P.quiet,
  },
});
