import { StyleSheet, Text, View } from "react-native";

/** Stable navy placeholders while the guide, debate and reader are loading. */
export function TrillionLoading() {
  return (
    <View
      style={s.screen}
      accessibilityLabel="Loading proposition"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <Text style={s.label}>Loading proposition…</Text>
      <View style={[s.bar, { width: "85%", height: 32 }]} />
      <View style={s.bar} />
      <View style={s.bar} />
      <View style={[s.bar, { width: "65%" }]} />
      <View style={[s.bar, { height: 110, marginTop: 24 }]} />
      <View style={[s.bar, { height: 110 }]} />
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0E1530", padding: 24, gap: 16 },
  label: { color: "#f7f4ee", fontSize: 15 },
  bar: {
    height: 16,
    width: "100%",
    backgroundColor: "#272d3c",
    borderRadius: 8,
  },
});
