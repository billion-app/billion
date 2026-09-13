import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  LinearTransition,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import type { Sector } from "~/utils/onboarding-store";
import { fontBody, DigestPalette as P } from "~/styles";
import { SPARK } from "./DrawnMark";

const LAYOUT = LinearTransition.springify().damping(18).stiffness(220);

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

function useClock(
  selected: boolean,
  duration: number,
  { pingPong = false } = {},
) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (selected && !reduce) {
      t.value = 0;
      t.value = withRepeat(
        withTiming(1, {
          duration,
          easing: pingPong ? Easing.inOut(Easing.quad) : Easing.linear,
        }),
        -1,
        pingPong,
      );
    } else {
      cancelAnimation(t);
      t.value = 0;
    }
  }, [duration, pingPong, reduce, selected, t]);
  return t;
}

function Technology({ selected }: { selected: boolean }) {
  const t = useClock(selected, 900, { pingPong: true });
  const core = useAnimatedProps(() => {
    const s = 1 + 0.28 * t.value;
    const size = 12 * s;
    return {
      x: 32 - size / 2,
      y: 32 - size / 2,
      width: size,
      height: size,
    };
  });
  return (
    <>
      <Rect
        x={20}
        y={20}
        width={24}
        height={24}
        rx={1.5}
        stroke={SPARK}
        strokeWidth={1.7}
        fill={SPARK}
        fillOpacity={0.14}
      />
      <AnimatedRect
        animatedProps={core}
        x={26}
        y={26}
        width={12}
        height={12}
        stroke={SPARK}
        strokeWidth={1.3}
        fill="none"
      />
      <Path
        d="M24 20V16M32 20V16M40 20V16M24 44V48M32 44V48M40 44V48M20 24H16M20 32H16M20 40H16M44 24H48M44 32H48M44 40H48"
        stroke={SPARK}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function Energy({ selected }: { selected: boolean }) {
  const t = useClock(selected, 2000);
  const blades = useAnimatedProps(() => {
    const a = t.value * Math.PI * 2;
    const len = 17;
    const pts = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((off) => {
      const ang = a + off;
      return `${32 + len * Math.sin(ang)} ${26 - len * Math.cos(ang)}`;
    });
    return { d: `M32 26L${pts[0]}M32 26L${pts[1]}M32 26L${pts[2]}` };
  });
  return (
    <>
      <Path
        d="M32 28V52M22 52H42"
        stroke={SPARK}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <AnimatedPath
        animatedProps={blades}
        d="M32 26L32 9M32 26L47 34M32 26L17 34"
        stroke={SPARK}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={32} cy={26} r={2.6} fill={SPARK} />
    </>
  );
}

const CA_GROUND = "M8 52H56";
const CA_BLOCK = "M10 52V36H14V28H20V52Z";
const CA_PYRAMID = "M32 11L37 31L41 31L42.5 52L23.5 52L25 31L29 31Z";
const CA_TOWER = "M46 52L47 18H52L53 52Z";
const CA_SPIRE = "M49.5 18V12";

function Fiscal({ selected }: { selected: boolean }) {
  const t = useClock(selected, 1600, { pingPong: true });
  const glow = useAnimatedProps(() => ({
    fillOpacity: 0.12 + t.value * 0.16,
  }));
  return (
    <>
      <Path
        d={CA_GROUND}
        stroke={SPARK}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <AnimatedPath
        animatedProps={glow}
        d={CA_BLOCK}
        stroke={SPARK}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill={SPARK}
      />
      <AnimatedPath
        animatedProps={glow}
        d={CA_PYRAMID}
        stroke={SPARK}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill={SPARK}
      />
      <AnimatedPath
        animatedProps={glow}
        d={CA_TOWER}
        stroke={SPARK}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill={SPARK}
      />
      <Path
        d={CA_SPIRE}
        stroke={SPARK}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </>
  );
}

function Healthcare({ selected }: { selected: boolean }) {
  const reduce = useReducedMotion();
  const beat = useSharedValue(0);
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = selected ? 1 : 0;
    if (selected && !reduce) {
      beat.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 110 }),
          withTiming(0, { duration: 110 }),
          withTiming(1, { duration: 110 }),
          withTiming(0, { duration: 720 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(beat);
      beat.value = 0;
    }
  }, [beat, on, reduce, selected]);
  const cross = useAnimatedProps(() => ({
    fillOpacity: 0.16 + beat.value * 0.2,
    strokeWidth: 1.7 + beat.value * 0.45,
  }));
  const ring = useAnimatedProps(() => ({
    r: 14 + beat.value * 12,
    opacity: on.value * (1 - beat.value) * 0.55,
  }));
  return (
    <>
      <AnimatedCircle
        animatedProps={ring}
        cx={32}
        cy={32}
        stroke={SPARK}
        fill="none"
        strokeWidth={1.2}
      />
      <AnimatedPath
        animatedProps={cross}
        d="M26 14H38V26H50V38H38V50H26V38H14V26H26V14Z"
        stroke={SPARK}
        strokeLinejoin="round"
        fill={SPARK}
      />
    </>
  );
}

function Infrastructure({ selected }: { selected: boolean }) {
  const on = useSharedValue(selected ? 1 : 0);
  const t = useClock(selected, 1800, { pingPong: true });
  useEffect(() => {
    on.value = selected ? 1 : 0;
  }, [on, selected]);
  const car = useAnimatedProps(() => {
    const p = t.value;
    const u = 1 - p;
    return {
      cx: u * u * 18 + 2 * u * p * 32 + p * p * 46,
      cy: u * u * 20 + 2 * u * p * 8 + p * p * 20,
      opacity: on.value,
    };
  });
  return (
    <>
      <Path
        d="M12 50H52"
        stroke={SPARK}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M18 20V50M46 20V50"
        stroke={SPARK}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M18 20Q32 8 46 20"
        stroke={SPARK}
        strokeWidth={1.6}
        fill="none"
      />
      <Path d="M24 24V50M32 22V50M40 24V50" stroke={SPARK} strokeWidth={1.2} />
      <AnimatedCircle animatedProps={car} r={2.4} fill={SPARK} />
    </>
  );
}

const PENTAGON = "M32 14 L51 27.8 L43.8 50.2 L20.2 50.2 L13 27.8 Z";

function Defense({ selected }: { selected: boolean }) {
  const on = useSharedValue(selected ? 1 : 0);
  const t = useClock(selected, 2400);
  useEffect(() => {
    on.value = selected ? 1 : 0;
  }, [on, selected]);
  const sweep = useAnimatedProps(() => {
    const a = t.value * Math.PI * 2;
    const len = 16;
    return {
      x2: 32 + len * Math.sin(a),
      y2: 34 - len * Math.cos(a),
      opacity: on.value,
    };
  });
  const blip = useAnimatedProps(() => {
    const a = t.value * Math.PI * 2;
    return {
      cx: 32 + 11 * Math.sin(a),
      cy: 34 - 11 * Math.cos(a),
      opacity: on.value,
    };
  });
  return (
    <>
      <Path
        d={PENTAGON}
        stroke={SPARK}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill={SPARK}
        fillOpacity={0.12}
      />
      <AnimatedLine
        animatedProps={sweep}
        x1={32}
        y1={34}
        x2={32}
        y2={18}
        stroke={SPARK}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <AnimatedCircle animatedProps={blip} r={2} fill={SPARK} />
    </>
  );
}

function Mark({ id, selected }: { id: Sector; selected: boolean }) {
  switch (id) {
    case "technology":
      return <Technology selected={selected} />;
    case "energy":
      return <Energy selected={selected} />;
    case "fiscal":
      return <Fiscal selected={selected} />;
    case "healthcare":
      return <Healthcare selected={selected} />;
    case "infrastructure":
      return <Infrastructure selected={selected} />;
    case "defense":
      return <Defense selected={selected} />;
  }
}

export function TopicOrb({
  id,
  label,
  selected,
  size,
  onPress,
}: {
  id: Sector;
  label: string;
  selected: boolean;
  size: number;
  onPress: () => void;
}) {
  const dim = selected ? size : Math.round(size * 0.9);
  const mark = Math.round(dim * 0.62);

  return (
    <Animated.View
      layout={LAYOUT}
      style={{ alignItems: "center", width: size }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={{ alignItems: "center" }}
      >
        <Animated.View
          layout={LAYOUT}
          style={[
            s.bubble,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
              borderColor: selected ? SPARK : "rgba(247,244,238,0.14)",
            },
          ]}
        >
          <Svg width={mark} height={mark} viewBox="0 0 64 64">
            <Mark id={id} selected={selected} />
          </Svg>
        </Animated.View>
        <Text style={[s.label, selected && s.labelOn]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bubble: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.stone,
  },
  label: {
    marginTop: 8,
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: P.quiet,
    textAlign: "center",
  },
  labelOn: { color: P.inkOnNight },
});
