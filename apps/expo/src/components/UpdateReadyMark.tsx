/** Billion B mark that morphs into a download glyph. */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { B_PATHS } from "~/components/BillionMarkPaths";

import { colors } from "~/styles";

export interface UpdateReadyMarkProps {
  size?: number;
  color?: string;
  mutedColor?: string;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);


const DL_ARROW = "M8.2 11 L10.1 13 L12 15.75 L13.9 13 L15.8 11";
const DL_SHAFT = "M12 4.5 L12 14";
const DL_TRAY_L = "M6.5 17.25 L6.5 20.6";
const DL_TRAY_R = "M17.5 17.25 L17.5 20.6";
const DL_TRAY_F = "M6.5 20.6 L17.5 20.6";

const LEN_ARROW = 22;
const LEN_SHAFT = 10;
const LEN_TRAY = 12;

const HOLD_MS = 400;
const MORPH_MS = 2000;
const LOOP_PERIOD_MS = 5000;

function StaticDownloadMark({
  size,
  color,
  structure,
}: {
  size: number;
  color: string;
  structure: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={DL_ARROW}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={DL_SHAFT}
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d={DL_TRAY_L}
        stroke={structure}
        strokeWidth={1.65}
        strokeLinecap="square"
      />
      <Path
        d={DL_TRAY_R}
        stroke={structure}
        strokeWidth={1.65}
        strokeLinecap="square"
      />
      <Path
        d={DL_TRAY_F}
        stroke={structure}
        strokeWidth={1.65}
        strokeLinecap="square"
      />
    </Svg>
  );
}

export function UpdateReadyMark({
  size = 22,
  color = colors.bill,
  mutedColor,
}: UpdateReadyMarkProps) {
  const structure = mutedColor ?? color;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    const holdAfter = Math.max(0, LOOP_PERIOD_MS - HOLD_MS - MORPH_MS);
    progress.value = withRepeat(
      withSequence(
        withDelay(
          HOLD_MS,
          withTiming(1, {
            duration: MORPH_MS,
            easing: Easing.inOut(Easing.cubic),
          }),
        ),
        withDelay(holdAfter, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [reduceMotion, progress]);

  const bLayerStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const opacity = interpolate(
      t,
      [0, 0.15, 0.55],
      [1, 0.85, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(t, [0, 0.55], [1, 0.55], Extrapolation.CLAMP);
    const rotate = interpolate(t, [0, 0.55], [0, -18], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const dlLayerStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const opacity = interpolate(
      t,
      [0.25, 0.55, 1],
      [0, 0.85, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      t,
      [0.25, 0.7, 1],
      [0.7, 0.95, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const arrowProps = useAnimatedProps(() => {
    const draw = interpolate(
      progress.value,
      [0.3, 0.85],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { strokeDashoffset: LEN_ARROW * (1 - draw) };
  });
  const shaftProps = useAnimatedProps(() => {
    const draw = interpolate(
      progress.value,
      [0.28, 0.75],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { strokeDashoffset: LEN_SHAFT * (1 - draw) };
  });
  const trayProps = useAnimatedProps(() => {
    const draw = interpolate(
      progress.value,
      [0.45, 0.95],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { strokeDashoffset: LEN_TRAY * (1 - draw) };
  });

  if (reduceMotion) {
    return (
      <StaticDownloadMark size={size} color={color} structure={structure} />
    );
  }

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, bLayerStyle]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {B_PATHS.map((d, i) => (
            <Path key={i} d={d} fill={color} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, dlLayerStyle]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <AnimatedPath
            d={DL_ARROW}
            animatedProps={arrowProps}
            stroke={color}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${LEN_ARROW} ${LEN_ARROW}`}
          />
          <AnimatedPath
            d={DL_SHAFT}
            animatedProps={shaftProps}
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeDasharray={`${LEN_SHAFT} ${LEN_SHAFT}`}
          />
          <AnimatedPath
            d={DL_TRAY_L}
            animatedProps={trayProps}
            stroke={structure}
            strokeWidth={1.65}
            strokeLinecap="square"
            strokeDasharray={`${LEN_TRAY} ${LEN_TRAY}`}
          />
          <AnimatedPath
            d={DL_TRAY_R}
            animatedProps={trayProps}
            stroke={structure}
            strokeWidth={1.65}
            strokeLinecap="square"
            strokeDasharray={`${LEN_TRAY} ${LEN_TRAY}`}
          />
          <AnimatedPath
            d={DL_TRAY_F}
            animatedProps={trayProps}
            stroke={structure}
            strokeWidth={1.65}
            strokeLinecap="square"
            strokeDasharray={`${LEN_TRAY} ${LEN_TRAY}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
