import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * Navy placeholders shaped like the reader's main case: the AI notice, the
 * question, the summary card, the lead dispute, the tabs and the first rows.
 * The reader replaces it in place, so nothing jumps when the debate arrives.
 */
export function TrillionLoading() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reduceMotion]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View
      style={s.screen}
      accessible
      accessibilityLabel="Loading proposition"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={[s.stack, fade]}>
        <View style={s.notice} />
        <View style={s.titleBlock}>
          <View style={[s.title, { width: "78%" }]} />
          <View style={[s.title, { width: "52%" }]} />
        </View>
        <View style={s.card}>
          <View style={s.kicker} />
          <View style={s.line} />
          <View style={s.line} />
          <View style={[s.line, { width: "60%" }]} />
        </View>
        <View style={[s.card, s.lead]}>
          <View style={[s.line, s.leadTitle]} />
          <View style={[s.line, { width: "45%", height: 10 }]} />
        </View>
        <View style={s.tabs}>
          <View style={[s.pill, { width: 84 }]} />
          <View style={[s.pill, { width: 96 }]} />
          <View style={[s.pill, { width: 120 }]} />
        </View>
        <View style={s.row} />
        <View style={s.row} />
      </Animated.View>
    </View>
  );
}

// Colors are the reader's: navy page, slate cards, raised slate for text lines.
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0E1530", paddingHorizontal: 16 },
  stack: { gap: 14, paddingTop: 14 },
  notice: {
    height: 42,
    borderRadius: 14,
    backgroundColor: "#272D3C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  titleBlock: { gap: 10, paddingVertical: 8 },
  title: { height: 26, borderRadius: 6, backgroundColor: "#272D3C" },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#272D3C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  kicker: {
    width: 88,
    height: 9,
    borderRadius: 4,
    backgroundColor: "rgba(212,175,55,0.35)",
  },
  line: { height: 13, borderRadius: 5, backgroundColor: "#3C4356" },
  lead: { borderRadius: 14, borderColor: "rgba(255,255,255,0.16)" },
  leadTitle: { width: "82%", height: 17 },
  tabs: { flexDirection: "row", gap: 8 },
  pill: {
    height: 38,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  row: { height: 82, borderRadius: 12, backgroundColor: "#272D3C" },
});
