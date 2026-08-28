/**
 * Loading placeholders mirroring the decision card's rhythm, so list and
 * detail screens don't jump when data arrives.
 */
import { StyleSheet, View } from "react-native";

import { useTheme } from "~/styles";

export function DecisionCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
      accessibilityLabel="Loading decisions"
    >
      <View style={s.spine} />
      <View style={s.content}>
        <View style={[s.chipRow, { backgroundColor: theme.muted }]} />
        <View style={[s.line, s.titleLine, { backgroundColor: theme.muted }]} />
        <View style={[s.line, { backgroundColor: theme.muted }]} />
        <View style={[s.lineShort, { backgroundColor: theme.muted }]} />
      </View>
    </View>
  );
}

export function DecisionListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={s.stack}>
      {Array.from({ length: count }, (_, i) => (
        <DecisionCardSkeleton key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  spine: { width: 3 },
  content: { flex: 1, padding: 14, gap: 9 },
  chipRow: {
    height: 18,
    width: 150,
    borderRadius: 999,
  },
  line: { height: 12, borderRadius: 6 },
  titleLine: { height: 16, width: "92%" },
  lineShort: { height: 12, borderRadius: 6, width: "55%" },
});
