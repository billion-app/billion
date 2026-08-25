/**
 * Lifecycle status chip for local-government decisions. Combines an icon,
 * plain-language label, and tint so states never rely on color alone.
 */
import { StyleSheet, Text, View } from "react-native";

import type { Theme } from "~/styles";
import type { DecisionLifecycle } from "~/utils/local-government";
import { Icon } from "~/components/ui/Icon";
import { colors, fontBody, useTheme } from "~/styles";
import {
  lifecycleAccessibilityLabel,
  lifecycleLabel,
  lifecycleVisual,
} from "~/utils/local-government";

const TINT: Record<
  "accent" | "success" | "warning" | "danger" | "muted",
  (theme: Theme) => string
> = {
  accent: () => colors.bill,
  success: () => colors.green[500],
  warning: () => colors.yellow[500],
  danger: () => colors.red[400],
  muted: (theme) => theme.textSecondary,
};

export function LifecycleChip({
  lifecycle,
  size = "sm",
}: {
  lifecycle: DecisionLifecycle;
  size?: "sm" | "md";
}) {
  const { theme } = useTheme();
  const visual = lifecycleVisual(lifecycle);
  const tint = TINT[visual.tint](theme);
  const iconSize = size === "md" ? 14 : 11;

  return (
    <View
      style={[
        s.chip,
        s[size],
        { backgroundColor: `${tint}1F`, borderColor: `${tint}55` },
      ]}
      accessibilityLabel={lifecycleAccessibilityLabel(lifecycle)}
    >
      <Icon name={visual.icon} size={iconSize} color={tint} />
      <Text style={[s.label, s[`${size}Label`], { color: tint }]}>
        {lifecycleLabel(lifecycle)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  md: { paddingHorizontal: 10, paddingVertical: 5 },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  smLabel: { fontSize: 10.5 },
  mdLabel: { fontSize: 12 },
});
