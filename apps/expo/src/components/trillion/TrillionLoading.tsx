import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "~/components/ui/Icon";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { fontBody, fontDisplay } from "~/styles";

/**
 * Navy placeholders shaped like the reader's main case: the AI notice, the
 * question, the summary card, the lead dispute, the tabs and the first rows.
 * Keep the same column width and reserve the main case's typical card heights.
 */
export function TrillionLoading({
  number,
  electionDate,
  notice = true,
  onBack,
}: {
  number?: string;
  electionDate?: string;
  notice?: boolean;
  onBack: () => void;
}) {
  const { t: tx, locale: appLocale } = useAppTranslation();

  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable
          style={s.back}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={tx("Back")}
          hitSlop={8}
        >
          <Icon name="chevL" size={20} color="#F7F4EE" />
        </Pressable>
        <View style={s.identity}>
          <Text style={s.eyebrow}>
            {electionDate
              ? tx("California · {value1}", {
                  value1: new Date(
                    `${electionDate}T12:00:00Z`,
                  ).toLocaleDateString(appLocale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  }),
                })
              : "California"}
          </Text>
          <Text style={s.headerTitle}>
            {tx("Proposition {value1} · The debate", { value1: number ?? "" })}
          </Text>
        </View>
      </View>
      <Animated.View
        style={[s.stack, fade]}
        accessible
        accessibilityLabel={tx("Loading proposition")}
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
      >
        {notice && <View style={s.notice} />}
        <View style={s.titleBlock}>
          <View style={[s.title, { width: "78%" }]} />
          <View style={[s.title, { width: "52%" }]} />
        </View>
        <View style={[s.card, s.summary]}>
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
        <View style={s.views} />
        <View style={s.grid}>
          <View style={s.row} />
          <View style={s.row} />
        </View>
        <View style={s.grid}>
          <View style={s.row} />
          <View style={s.row} />
        </View>
      </Animated.View>
    </View>
  );
}

// Colors are the reader's: navy page, slate cards, raised slate for text lines.
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0E1530", overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#272D3C",
  },
  identity: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 0.88,
    textTransform: "uppercase",
    color: "#D4AF37",
  },
  headerTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    lineHeight: 20.4,
    color: "#F7F4EE",
  },
  stack: { gap: 14, paddingTop: 12, paddingHorizontal: 16 },
  notice: {
    height: 41,
    borderRadius: 12,
    backgroundColor: "#323848",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  titleBlock: { gap: 8, paddingVertical: 4, marginBottom: 12 },
  title: { height: 28, borderRadius: 6, backgroundColor: "#272D3C" },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#272D3C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  summary: { minHeight: 166 },
  kicker: {
    width: 88,
    height: 9,
    borderRadius: 4,
    backgroundColor: "rgba(212,175,55,0.35)",
  },
  line: { height: 13, borderRadius: 5, backgroundColor: "#3C4356" },
  lead: {
    minHeight: 104,
    marginTop: -2,
    borderColor: "rgba(255,255,255,0.16)",
  },
  leadTitle: { width: "82%", height: 17 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 8 },
  pill: {
    height: 38,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  views: { height: 43, borderRadius: 12, backgroundColor: "#272D3C" },
  grid: { flexDirection: "row", gap: 10 },
  row: { flex: 1, height: 100, borderRadius: 12, backgroundColor: "#272D3C" },
});
