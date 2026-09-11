import { useEffect } from "react";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Path } from "react-native-svg";

import { DigestPalette as P } from "~/styles";

export const DRAW = Easing.bezier(0.22, 1, 0.36, 1);
export const SPARK = P.spark;
export const QUIET = P.quiet;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function useDraw(selected: boolean, delay = 0, duration = 680) {
  const reduce = useReducedMotion();
  const p = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      p.value = selected ? 1 : 0;
      return;
    }
    p.value = selected
      ? withDelay(delay, withTiming(1, { duration, easing: DRAW }))
      : withTiming(0, { duration: 280, easing: DRAW });
  }, [delay, duration, p, reduce, selected]);
  return p;
}

export function DrawnPath({
  d,
  length,
  selected,
  delay,
  fill = true,
  weight = 1.5,
}: {
  d: string;
  length: number;
  selected: boolean;
  delay: number;
  fill?: boolean;
  weight?: number;
}) {
  const p = useDraw(selected, delay);
  const gold = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - p.value),
    fillOpacity: fill
      ? interpolate(p.value, [0, 0.55, 1], [0, 0, 0.12])
      : 0,
  }));
  return (
    <>
      <Path
        d={d}
        stroke={QUIET}
        strokeWidth={weight}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <AnimatedPath
        animatedProps={gold}
        d={d}
        stroke={SPARK}
        strokeWidth={weight + 0.15}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={fill ? SPARK : "none"}
        strokeDasharray={length}
      />
    </>
  );
}

/** Gold stroke that appears along a master 0–1 timeline. */
export function TimedStroke({
  d,
  t,
  a,
  b,
  length,
  weight = 1.4,
  color = SPARK,
}: {
  d: string;
  t: { value: number };
  a: number;
  b: number;
  length: number;
  weight?: number;
  color?: string;
}) {
  const gold = useAnimatedProps(() => {
    const local = interpolate(
      t.value,
      [a, b],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { strokeDashoffset: length * (1 - local) };
  });
  return (
    <AnimatedPath
      animatedProps={gold}
      d={d}
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[length, length]}
    />
  );
}
