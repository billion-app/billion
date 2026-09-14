/**
 * Metallic gold B, and the greeting script that uses the same foil.
 * The highlight tracks device tilt (Reanimated gravity) and keeps a slow
 * idle pass so it still reads when the phone is still or the simulator
 * has no motion.
 *
 * Paths are filled with the foil gradient (no clip-mask). ClipPath in
 * react-native-svg rasterizes at 1x, which is what made the 18px B look
 * like a blown-up bitmap.
 *
 * No Skia / expo-gl — stays inside the current native fingerprint.
 */
import { useId, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Platform, Text, View } from "react-native";
import Animated, {
  SensorType,
  useAnimatedProps,
  useAnimatedSensor,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { B_PATHS } from "~/components/BillionMarkPaths";
import { DigestFonts, DigestPalette as P } from "~/styles";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const GOLD = P.spark;
const VB = 24;
const SHEET_W = 40;
const SHEET_H = 36;
const SCRIPT_SIZE = 42;
const SCRIPT_BOX_H = 88;
const SCRIPT_FAMILY = Platform.select({
  ios: DigestFonts.greetingScript.ios,
  default: DigestFonts.greetingScript.default,
});

function useFoilSheets(boxW: number, boxH: number, enabled: boolean) {
  const clock = useSharedValue(0);
  const boxWSv = useSharedValue(boxW);
  const boxHSv = useSharedValue(boxH);
  boxWSv.value = boxW;
  boxHSv.value = boxH;

  useFrameCallback((info) => {
    "worklet";
    clock.value = info.timestamp / 1000;
  }, enabled);

  const gravity = useAnimatedSensor(SensorType.GRAVITY, {
    interval: "auto",
    adjustToInterfaceOrientation: true,
  });

  const foilGradProps = useAnimatedProps(() => {
    const sx = boxWSv.value / VB;
    const sy = boxHSv.value / VB;
    const sweep = Math.sin(clock.value * 1.35) * 8 * sx;
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const gy = Math.max(-1, Math.min(1, gravity.sensor.value.y));
    const x = (-10 + gx * 10) * sx + sweep;
    const y = (-6 + gy * 6) * sy;
    return {
      x1: x,
      y1: y,
      x2: x + SHEET_W * sx,
      y2: y + SHEET_H * sy,
    };
  });

  const specGradProps = useAnimatedProps(() => {
    const sx = boxWSv.value / VB;
    const sy = boxHSv.value / VB;
    const sweep = Math.sin(clock.value * 1.75 + 0.6) * 10 * sx;
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const x = (-12 - gx * 8) * sx + sweep;
    return {
      x1: x,
      y1: 0,
      x2: x + SHEET_W * sx,
      y2: 0.4 * VB * sy,
    };
  });

  const tilt = useAnimatedStyle(() => {
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const gy = Math.max(-1, Math.min(1, gravity.sensor.value.y));
    const idle = Math.sin(clock.value * 0.55) * 1.2;
    return {
      transform: [
        { perspective: 240 },
        { rotateY: `${gx * 6 + idle}deg` },
        { rotateX: `${-gy * 3}deg` },
      ],
    };
  });

  const hotClip = useAnimatedStyle(() => {
    const sx = boxWSv.value / VB;
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const x = (-10 + gx * 10) * sx + Math.sin(clock.value * 1.35) * 8 * sx;
    return { transform: [{ translateX: x }] };
  });
  const hotFill = useAnimatedStyle(() => {
    const sx = boxWSv.value / VB;
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const x = (-10 + gx * 10) * sx + Math.sin(clock.value * 1.35) * 8 * sx;
    return { transform: [{ translateX: -x }] };
  });
  const shineClip = useAnimatedStyle(() => {
    const sx = boxWSv.value / VB;
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const x = (-12 - gx * 8) * sx + Math.sin(clock.value * 1.75 + 0.6) * 10 * sx;
    return { transform: [{ translateX: x }] };
  });
  const shineFill = useAnimatedStyle(() => {
    const sx = boxWSv.value / VB;
    const gx = Math.max(-1, Math.min(1, gravity.sensor.value.x));
    const x = (-12 - gx * 8) * sx + Math.sin(clock.value * 1.75 + 0.6) * 10 * sx;
    return { transform: [{ translateX: -x }] };
  });

  return {
    foilGradProps,
    specGradProps,
    tilt,
    hotClip,
    hotFill,
    shineClip,
    shineFill,
  };
}

function FoilMarkPaths({ fill }: { fill: string }) {
  return (
    <>
      {B_PATHS.map((d, i) => (
        <Path
          key={i}
          d={d}
          fill={fill}
          stroke={fill === GOLD ? GOLD : "none"}
          strokeWidth={fill === GOLD ? 0.35 : 0}
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

export function GoldBillionMark({ size }: { size: number }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const foilId = `bfoil-${uid}`;
  const specId = `bspec-${uid}`;
  const foil = useFoilSheets(VB, VB, !reduce);
  const tiltOn = size >= 48;

  const svg = reduce ? (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <FoilMarkPaths fill={GOLD} />
    </Svg>
  ) : (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <AnimatedLinearGradient
          id={foilId}
          gradientUnits="userSpaceOnUse"
          animatedProps={foil.foilGradProps}
          x1={-10}
          y1={-6}
          x2={30}
          y2={30}
        >
          <Stop offset="0" stopColor="#3D2A0C" />
          <Stop offset="0.18" stopColor="#8A6410" />
          <Stop offset="0.38" stopColor={GOLD} />
          <Stop offset="0.5" stopColor="#FFE9A8" />
          <Stop offset="0.62" stopColor={GOLD} />
          <Stop offset="0.82" stopColor="#8A6410" />
          <Stop offset="1" stopColor="#3D2A0C" />
        </AnimatedLinearGradient>
        <AnimatedLinearGradient
          id={specId}
          gradientUnits="userSpaceOnUse"
          animatedProps={foil.specGradProps}
          x1={-12}
          y1={0}
          x2={28}
          y2={10}
        >
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.62" />
          <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </AnimatedLinearGradient>
      </Defs>
      {B_PATHS.map((d, i) => (
        <Path
          key={i}
          d={d}
          fill={`url(#${foilId})`}
          stroke={`url(#${foilId})`}
          strokeWidth={0.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {B_PATHS.map((d, i) => (
        <Path key={`s-${i}`} d={d} fill={`url(#${specId})`} />
      ))}
    </Svg>
  );

  if (reduce || !tiltOn) {
    return svg;
  }

  return (
    <Animated.View
      style={[{ width: size, height: size }, foil.tilt]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {svg}
    </Animated.View>
  );
}

const scriptFlat = {
  fontFamily: SCRIPT_FAMILY,
  fontSize: SCRIPT_SIZE,
  color: GOLD,
  letterSpacing: 0.2,
  fontWeight: Platform.OS === "ios" ? ("400" as const) : undefined,
  textAlign: "center" as const,
};

/**
 * Greeting ceremony script with the same foil pass as the B.
 * Duplicate native text clipped to traveling bands — keeps Snell / Great
 * Vibes and stays inside the current native fingerprint.
 */
export function GoldFoilScript({
  text,
  width,
}: {
  text: string;
  width: number;
}) {
  const reduce = useReducedMotion();
  const foil = useFoilSheets(width, SCRIPT_BOX_H, !reduce);
  const hotW = Math.max(92, Math.round(width * 0.32));
  const specW = Math.max(52, Math.round(width * 0.18));

  if (!text) {
    return <View style={{ width, height: SCRIPT_BOX_H }} />;
  }

  if (reduce) {
    return <Text style={scriptFlat}>{text}</Text>;
  }

  return (
    <View
      style={{
        width,
        height: SCRIPT_BOX_H,
        justifyContent: "center",
        overflow: "hidden",
      }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Text style={scriptFlat}>{text}</Text>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: hotW,
            overflow: "hidden",
            justifyContent: "center",
          },
          foil.hotClip,
        ]}
      >
        <Animated.Text
          style={[scriptFlat, { width, color: "#FFE9A8" }, foil.hotFill]}
        >
          {text}
        </Animated.Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: specW,
            overflow: "hidden",
            justifyContent: "center",
          },
          foil.shineClip,
        ]}
      >
        <Animated.Text
          style={[
            scriptFlat,
            { width, color: "rgba(255,255,255,0.62)" },
            foil.shineFill,
          ]}
        >
          {text}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

/**
 * Tracked uppercase eyebrows with the same traveling foil as the B / greeting.
 * Hug-content; reduced motion falls back to flat spark.
 */
export function GoldFoilText({
  text,
  style,
  numberOfLines = 1,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const foil = useFoilSheets(Math.max(box.w, 1), Math.max(box.h, 1), !reduce);
  const hotW = Math.max(24, Math.round(Math.max(box.w, 72) * 0.36));
  const specW = Math.max(14, Math.round(Math.max(box.w, 72) * 0.16));

  if (!text) return null;

  if (reduce) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <View
      style={{ alignSelf: "flex-start", overflow: "hidden" }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (
          Math.abs(width - box.w) < 0.5 &&
          Math.abs(height - box.h) < 0.5
        ) {
          return;
        }
        setBox({ w: width, h: height });
      }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Text
        style={style}
        numberOfLines={numberOfLines}
        importantForAccessibility="no-hide-descendants"
      >
        {text}
      </Text>
      {box.w > 0 ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: hotW,
                overflow: "hidden",
                justifyContent: "center",
              },
              foil.hotClip,
            ]}
          >
            <Animated.Text
              style={[
                style,
                { width: box.w, color: "#FFE9A8" },
                foil.hotFill,
              ]}
              numberOfLines={numberOfLines}
            >
              {text}
            </Animated.Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: specW,
                overflow: "hidden",
                justifyContent: "center",
              },
              foil.shineClip,
            ]}
          >
            <Animated.Text
              style={[
                style,
                { width: box.w, color: "rgba(255,255,255,0.58)" },
                foil.shineFill,
              ]}
              numberOfLines={numberOfLines}
            >
              {text}
            </Animated.Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}
