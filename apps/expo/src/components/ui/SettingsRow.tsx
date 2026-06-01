/** SettingsRow — icon tile + label + optional subtitle + chevron. */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { IconName } from "./Icon";
import { colors, fontBody, hair, planes } from "~/styles";
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
  const fg = danger ? colors.red[500] : colors.white;
  return (
    <TouchableOpacity
      style={[s.row, !last && s.divider]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.tile}>
        <Icon name={icon} size={19} color={fg} />
      </View>
      <View style={s.body}>
        <Text style={[s.label, { color: fg }]}>{label}</Text>
        {sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      <Icon name="chevR" size={18} color="#5B6172" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: hair[1] },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  label: { fontFamily: fontBody.semibold, fontSize: 15.5 },
  sub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
