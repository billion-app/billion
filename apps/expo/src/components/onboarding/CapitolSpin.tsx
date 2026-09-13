/**
 * The welcome Capitol, turning slowly under the watch picks.
 * Neighboring yaw frames are lerped so the drum and dome read as 3D.
 * Extra strokes fade in as the reader marks more options.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { DigestPalette as P } from "~/styles";
import { SPIN_AZ0, SPIN_BANDS, SPIN_N, SPIN_VIEW } from "./capitol3d";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TURN_MS = 16000;
const DETAIL_MS = 560;
const VB = `0 0 ${SPIN_VIEW.w} ${SPIN_VIEW.h}`;
const PULL = Easing.bezier(0.22, 1, 0.36, 1);
const BAND_IN: [number, number][] = [
  [-1, 0],
  [0, 0.38],
  [0.22, 0.55],
  [0.42, 0.68],
  [0.68, 1],
];

function pathFrom(flat: number[], breaks: number[]): string {
  "worklet";
  if (flat.length === 0) return "M0 0";
  let d = "";
  const nPts = flat.length / 2;
  for (let p = 0; p < breaks.length; p++) {
    const start = breaks[p]!;
    const end = p + 1 < breaks.length ? breaks[p + 1]! : nPts;
    for (let i = start; i < end; i++) {
      const x = Math.round(flat[i * 2]! * 10) / 10;
      const y = Math.round(flat[i * 2 + 1]! * 10) / 10;
      d += (i === start ? "M" : "L") + x + " " + y;
    }
  }
  return d.length > 0 ? d : "M0 0";
}

function lerpLayer(az: number, frames: number[][], breaks: number[]): string {
  "worklet";
  if (frames.length === 0 || (frames[0]?.length ?? 0) === 0) return "M0 0";
  const turns = (az - SPIN_AZ0) / 360;
  const x = (turns - Math.floor(turns)) * SPIN_N;
  const i0 = Math.floor(x) % SPIN_N;
  const i1 = (i0 + 1) % SPIN_N;
  const u = x - Math.floor(x);
  const a = frames[i0]!;
  const b = frames[i1]!;
  const mixed: number[] = [];
  for (let i = 0; i < a.length; i++) {
    mixed.push(a[i]! + (b[i]! - a[i]!) * u);
  }
  return pathFrom(mixed, breaks);
}

function Band({
  az,
  frames,
  breaks,
  detail,
  from,
  to,
  weight,
}: {
  az: { value: number };
  frames: number[][];
  breaks: number[];
  detail: { value: number };
  from: number;
  to: number;
  weight: number;
}) {
  const props = useAnimatedProps(() => ({
    d: lerpLayer(az.value, frames, breaks),
    opacity: interpolate(detail.value, [from, to], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <AnimatedPath
      d={pathFrom(frames[0] ?? [], breaks)}
      animatedProps={props}
      stroke={P.spark}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export function CapitolSpin({
  active,
  width,
  picks,
  max = 4,
}: {
  active: boolean;
  width: number;
  picks: number;
  max?: number;
}) {
  const reduce = useReducedMotion();
  const az = useSharedValue(SPIN_AZ0);
  const detail = useSharedValue(0);
  const [box, setBox] = useState(180);
  const target = Math.max(0, Math.min(1, picks / Math.max(1, max)));

  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(az);
      az.value = SPIN_AZ0;
      return;
    }
    az.value = SPIN_AZ0;
    az.value = withRepeat(
      withTiming(SPIN_AZ0 + 360, {
        duration: TURN_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [active, az, reduce]);

  useEffect(() => {
    if (reduce) {
      detail.value = target;
      return;
    }
    detail.value = withTiming(target, { duration: DETAIL_MS, easing: PULL });
  }, [detail, reduce, target]);

  const rig = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          detail.value,
          [0, 1],
          [0.92, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View
      style={[s.wrap, { width }]}
      pointerEvents="none"
      onLayout={(e) => setBox(e.nativeEvent.layout.height)}
    >
      <Animated.View style={[s.rig, rig]}>
        <Svg
          width={width}
          height={Math.max(140, box)}
          viewBox={VB}
          preserveAspectRatio="xMidYMax meet"
        >
          {SPIN_BANDS.map((band, i) => (
            <Band
              key={i}
              az={az}
              frames={band.frames}
              breaks={band.breaks}
              detail={detail}
              from={BAND_IN[i]![0]}
              to={BAND_IN[i]![1]}
              weight={i >= 3 ? 1.55 : 1.25}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignSelf: "center",
    overflow: "hidden",
  },
  rig: {
    flex: 1,
  },
});
