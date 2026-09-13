/** Segmented — Digest night control (The brief / Original text). */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { IconName } from "./Icon";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  DigestPalette as P,
} from "~/styles";
import { Icon } from "./Icon";

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const active = value === o.id;
        const fg = active ? P.spark : P.quiet;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
            style={[s.seg, active ? s.segActive : undefined]}
          >
            {o.icon && <Icon name={o.icon} size={15} color={fg} />}
            <Text style={[s.segText, { color: fg }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: P.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    height: 38,
    borderRadius: DigestRadii.menuRow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segActive: {
    backgroundColor: DigestHair.tabActivePill,
  },
  segText: { fontFamily: fontBody.semibold, fontSize: 13.5 },
});
