/**
 * Page 4 — notifications, not photographs.
 * Two cadence cards. The stage above shows an iOS banner so the
 * tap has a consequence you can see.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { BlurView } from "expo-blur";

import { B_PATHS } from "~/components/BillionMarkPaths";
import {
  DigestRadii,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";

const SLIDE = Easing.bezier(0.22, 1, 0.36, 1);
const SPRING = { dampingRatio: 0.78, duration: 520 } as const;

const INSTANT = [
  { time: "now", title: "A bill you follow moved.", body: "See what changed." },
  {
    time: "now",
    title: "Something changed in California.",
    body: "Here’s what it means.",
  },
] as const;

const EVENING = {
  time: "7:00 PM",
  title: "While you were away",
  body: "3 things changed.",
};

export function ArriveStage({
  active,
  instant,
  evening,
  onInstant,
  onEvening,
}: {
  active: boolean;
  instant: boolean;
  evening: boolean;
  onInstant: () => void;
  onEvening: () => void;
}) {
  const idle = !instant && !evening;

  return (
    <View style={s.root}>
      <Text style={s.headline}>When it lands.</Text>
      <Text style={s.dek}>Pick how the brief finds you. Quietly.</Text>

      <View style={s.stage}>
        {idle ? (
          <View style={s.ghost} accessibilityElementsHidden>
            <View style={s.mark}>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                {B_PATHS.map((d) => (
                  <Path key={d.slice(0, 10)} d={d} fill={P.quiet} />
                ))}
              </Svg>
            </View>
            <View style={s.copy}>
              <View style={s.top}>
                <Text style={s.app}>BILLION</Text>
                <Text style={s.time}>here</Text>
              </View>
              <Text style={s.ghostTitle}>Your brief lands here.</Text>
              <Text style={s.body}>Tap a cadence below.</Text>
            </View>
          </View>
        ) : null}
        {INSTANT.map((n, i) => (
          <Banner
            key={`i-${i}`}
            show={active && instant}
            delay={i * 160}
            stack={i}
            time={n.time}
            title={n.title}
            body={n.body}
          />
        ))}
        <Banner
          show={active && evening}
          delay={instant ? 380 : 80}
          stack={instant ? 2 : 0}
          time={EVENING.time}
          title={EVENING.title}
          body={EVENING.body}
        />
      </View>

      <Choice
        title="When it moves"
        hint="Only for things you follow"
        selected={instant}
        onPress={onInstant}
      />
      <Choice
        title="Once, at 7"
        hint="One brief. That’s it."
        selected={evening}
        onPress={onEvening}
      />
    </View>
  );
}

function Choice({
  title,
  hint,
  selected,
  onPress,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[s.card, selected && s.cardOn]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.choice, selected && s.choiceOn]}>{title}</Text>
        <Text style={[s.hint, selected && s.hintOn]}>{hint}</Text>
      </View>
      <View style={[s.tick, selected && s.tickOn]} />
    </Pressable>
  );
}

function Banner({
  show,
  delay,
  stack,
  time,
  title,
  body,
}: {
  show: boolean;
  delay: number;
  stack: number;
  time: string;
  title: string;
  body: string;
}) {
  const reduce = useReducedMotion();
  const y = useSharedValue(-28);
  const o = useSharedValue(0);

  useEffect(() => {
    if (show) {
      if (reduce) {
        y.value = stack * 76;
        o.value = 1;
        return;
      }
      y.value = -120;
      o.value = 0;
      y.value = withDelay(delay, withSpring(stack * 76, SPRING));
      o.value = withDelay(delay, withTiming(1, { duration: 180 }));
      const t = setTimeout(() => Vibration.vibrate(8), delay);
      return () => clearTimeout(t);
    }
    y.value = withTiming(-120, { duration: 280, easing: SLIDE });
    o.value = withTiming(0, { duration: 200 });
  }, [delay, o, reduce, show, stack, y]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View style={[s.bannerWrap, { zIndex: 4 - stack }, style]}>
      <BlurView intensity={36} tint="dark" style={s.banner}>
        <View style={s.mark}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            {B_PATHS.map((d) => (
              <Path key={d.slice(0, 10)} d={d} fill={P.inkOnNight} />
            ))}
          </Svg>
        </View>
        <View style={s.copy}>
          <View style={s.top}>
            <Text style={s.app}>BILLION</Text>
            <Text style={s.time}>{time}</Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body} numberOfLines={1}>
            {body}
          </Text>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: P.inkOnNight,
  },
  dek: {
    marginTop: 10,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 22,
    color: P.quiet,
  },
  stage: {
    flex: 1,
    marginTop: 24,
    marginBottom: 12,
    minHeight: 160,
  },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DigestRadii.menu,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.16)",
    borderStyle: "dashed",
  },
  ghostTitle: {
    marginTop: 2,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.quiet,
  },
  bannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DigestRadii.menu,
    overflow: "hidden",
    backgroundColor: "rgba(39,45,60,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.14)",
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: P.night,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  app: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: P.quiet,
  },
  time: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: P.quiet,
  },
  title: {
    marginTop: 2,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
  },
  body: {
    marginTop: 1,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: DigestRadii.menu,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.14)",
  },
  cardOn: {
    borderWidth: 1.5,
    borderColor: P.spark,
  },
  choice: {
    fontFamily: fontDisplay.regular,
    fontSize: 20,
    letterSpacing: -0.3,
    color: P.inkOnNight,
  },
  choiceOn: { color: P.inkOnNight },
  hint: {
    marginTop: 3,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
  },
  hintOn: { color: P.quiet },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.28)",
  },
  tickOn: {
    borderWidth: 0,
    backgroundColor: P.spark,
  },
});
