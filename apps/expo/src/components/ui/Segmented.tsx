/** Segmented — pill segmented control (e.g. Plain explainer / Original text). */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, fontBody, hair, planes } from "~/styles";

import type { IconName } from "./Icon";
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
        const fg = active ? planes.ink : "rgba(255,255,255,0.62)";
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
            style={[
              s.seg,
              { backgroundColor: active ? colors.white : "transparent" },
            ]}
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
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segText: { fontFamily: fontBody.semibold, fontSize: 13.5 },
});
