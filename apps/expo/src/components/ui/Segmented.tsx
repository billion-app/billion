/** Segmented — Digest night control (The brief / Original text). */
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import type { IconName } from "./Icon";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  DigestPalette as P,
  BillReaderPalette as R,
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
  iconPosition = "beside",
  wrap = false,
  appearance = "segmented",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  iconPosition?: "beside" | "above";
  /** Reflow long topic labels with available width, including browser zoom. */
  wrap?: boolean;
  appearance?: "segmented" | "underline";
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const underline = appearance === "underline";
  return (
    <View
      accessibilityRole="tablist"
      style={[
        s.wrap,
        underline && s.underlineWrap,
        wrap && { flexWrap: "wrap" },
        stacked && { flexDirection: "column" },
      ]}
    >
      {options.map((o) => {
        const active = value === o.id;
        const fg = underline
          ? active
            ? R.text
            : R.muted
          : active
            ? P.canvas
            : P.inkOnNight;
        return (
          <TouchableOpacity
            key={o.id}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            aria-selected={active}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
            style={[
              s.seg,
              iconPosition === "above" &&
                !stacked && { flexDirection: "column" },
              wrap &&
                !stacked && { flexBasis: 140, flexGrow: 1, flexShrink: 0 },

              stacked && { flex: 0 },
              underline
                ? [s.underlineTab, active && s.underlineActive]
                : active
                  ? s.segActive
                  : undefined,
            ]}
          >
            {o.icon && !underline && (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
              >
                <Icon name={o.icon} size={15} color={fg} />
              </View>
            )}
            <Text key={fontScale} style={[s.segText, { color: fg }]}>
              {o.label}
            </Text>
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
  underlineWrap: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    gap: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: R.rule,
  },
  underlineTab: {
    borderRadius: 0,
    paddingHorizontal: 0,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  underlineActive: { borderBottomColor: R.secondary },
  seg: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: DigestRadii.menuRow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segActive: {
    backgroundColor: P.primary,
  },
  segText: {
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    textAlign: "center",
  },
});
