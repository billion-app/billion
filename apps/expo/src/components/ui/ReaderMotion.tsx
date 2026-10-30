import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useEffect } from "react";
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BillReaderPalette as R } from "~/styles";
import { Icon } from "./Icon";

export const readerLayout = LinearTransition.duration(200)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

/** A small reveal within the reading flow. No stagger or delayed controls. */
export function ReaderReveal({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.withInitialValues({
        opacity: 0,
        transform: [{ translateY: 6 }],
      })
        .duration(180)
        .easing(Easing.out(Easing.cubic))
        .reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(100).reduceMotion(ReduceMotion.System)}
      layout={readerLayout}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function ReaderDisclosureIcon({ expanded }: { expanded: boolean }) {
  const rotation = useSharedValue(expanded ? 180 : 0);
  useEffect(() => {
    rotation.value = withTiming(expanded ? 180 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [expanded, rotation]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View
      style={style}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="chevD" size={17} color={expanded ? R.accent : R.muted} />
    </Animated.View>
  );
}
