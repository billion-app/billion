import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Quiet touch feedback for the bill reader. Never delays the action or
 * competes with a ScrollView's native cancellation of a press during a drag.
 */
export function ReaderPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  depth = "flat",
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  depth?: "flat" | "card";
}) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const feedback = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * (depth === "card" ? 0.06 : 0.22),
    transform: [
      {
        scale: reduceMotion || depth === "flat" ? 1 : 1 - pressed.value * 0.015,
      },
    ],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[style, feedback]}
      onPressIn={(event) => {
        pressed.value = withTiming(1, {
          duration: 100,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        });
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
