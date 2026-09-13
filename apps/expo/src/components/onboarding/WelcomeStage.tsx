/**
 * Welcome — one Capitol. Pull back, then the house compresses into the B.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { B_PATHS } from "~/components/BillionMarkPaths";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";
import { CAPITOL_HERO, CAPITOL_VIEW } from "./capitol3d";

const PULL = Easing.bezier(0.22, 1, 0.36, 1);
const SQUEEZE = Easing.bezier(0.64, 0.02, 0.16, 1);
const MARK = 84;
const VB = `0 0 ${CAPITOL_VIEW.w} ${CAPITOL_VIEW.h}`;

export function WelcomeStage({
  width,
  height,
  bottom,
  active,
}: {
  width: number;
  height: number;
  bottom: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    if (reduce) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withSequence(
      withTiming(0.4, { duration: 1200, easing: PULL }),
      withTiming(0.48, {
        duration: 280,
        easing: Easing.inOut(Easing.sin),
      }),
      withTiming(1, { duration: 1600, easing: SQUEEZE }),
    );
  }, [active, reduce, t]);

  const rig = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: interpolate(
        p,
        [0.48, 0.72, 0.86, 0.94],
        [1, 1, 0.35, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            p,
            [0, 0.4, 0.48],
            [-10, 0, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(
            p,
            [0, 0.4, 0.48],
            [28, 0, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleX: interpolate(
            p,
            [0, 0.4, 0.48, 0.62, 0.78, 1],
            [1.14, 1, 1, 0.52, 0.22, 0.1],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleY: interpolate(
            p,
            [0, 0.4, 0.48, 0.62, 0.78, 1],
            [1.2, 1, 1, 0.74, 0.3, 0.14],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const logo = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: interpolate(
        p,
        [0.7, 0.82, 0.9, 1],
        [0, 0.55, 1, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            p,
            [0.7, 0.84, 0.94, 1],
            [0.42, 0.92, 1.04, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const copy = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.84, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[s.root, { width, height }]} pointerEvents="none">
      <Animated.View style={[s.rig, { width, height }, rig]}>
        <Svg
          width={width}
          height={height}
          viewBox={VB}
          preserveAspectRatio="xMidYMid meet"
        >
          <Path
            d={CAPITOL_HERO.structure}
            stroke={P.spark}
            strokeWidth={1.45}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={CAPITOL_HERO.vault}
            stroke={P.spark}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: "absolute",
            width: MARK,
            height: MARK,
            left: (width - MARK) / 2,
            top: (height - MARK) / 2,
          },
          logo,
        ]}
      >
        <Svg width={MARK} height={MARK} viewBox="0 0 24 24">
          {B_PATHS.map((d, i) => (
            <Path key={i} d={d} fill={P.spark} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View style={[s.copy, { paddingBottom: bottom }, copy]}>
        <Text style={s.headline}>Tomorrow’s brief.</Text>
        <Text style={s.dek}>What the government did. In English.</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    backgroundColor: P.night,
    overflow: "hidden",
  },
  rig: {
    ...StyleSheet.absoluteFill,
  },
  copy: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
  },
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
});
