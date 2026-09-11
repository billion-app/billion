/**
 * The registration reveal — a sheet over the briefing the reader just built.
 *
 * Sign-up is not built. Apple / Google / email say so when tapped. "Explore
 * first" is the real exit: the workspace is already on the device.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BlurView } from "expo-blur";
import { useSegments } from "expo-router";

import { useOnboarding } from "~/hooks/useOnboarding";
import { fontBody, fontDisplay } from "~/styles";
import { SECTOR_SHORT, VECTOR_SHORT } from "~/utils/onboarding-store";

const GOLD = "#C4A35A";
const INK = "#16131A";
const PAPER = "#F7F4EE";

const RISE_MS = 620;
const FALL_MS = 360;

function comingSoon() {
  Alert.alert(
    "Accounts are coming soon",
    "Sign-in isn’t built yet. Your workspace is already saved on this device — nothing is lost while you explore.",
    [{ text: "Got it" }],
  );
}

export function ClaimWorkspaceGate() {
  const onboarding = useOnboarding();
  const segments = useSegments();
  const inFlow = segments[0] === "(onboarding)";
  const visible =
    !onboarding.isLoading &&
    onboarding.completed &&
    !onboarding.deferredClaim &&
    !inFlow;

  return (
    <ClaimWorkspaceSheet
      visible={visible}
      onDismiss={() => onboarding.update({ deferredClaim: true })}
    />
  );
}

export function ClaimWorkspaceSheet({
  visible,
  onDismiss,
  lines: linesProp,
  signals: signalsProp,
}: {
  visible: boolean;
  onDismiss: () => void;
  lines?: string[];
  signals?: number;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const onboarding = useOnboarding();
  const [present, setPresent] = useState(visible);

  const t = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = visible ? 1 : 0;
      return;
    }
    t.value = visible
      ? withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.cubic) })
      : withTiming(0, { duration: FALL_MS, easing: Easing.in(Easing.cubic) });
  }, [visible, reduceMotion, t]);

  useAnimatedReaction(
    () => t.value > 0.001,
    (onScreen, was) => {
      if (onScreen !== was) runOnJS(setPresent)(onScreen);
    },
  );

  const backdrop = useAnimatedStyle(() => ({ opacity: t.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [420, 0]) }],
  }));

  if (!present && !visible) return null;

  const lines =
    linesProp ??
    [
      ...onboarding.vectors.map((id) => VECTOR_SHORT[id]),
      ...onboarding.sectors.map((id) => SECTOR_SHORT[id]),
    ];
  const signals =
    signalsProp ??
    12 +
      onboarding.vectors.length * 7 +
      onboarding.sectors.length * 5 +
      onboarding.topics.length * 3;

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View style={[s.fill, backdrop]} pointerEvents="none">
        <BlurView intensity={22} tint="dark" style={s.fill} />
        <View style={s.scrim} />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: Math.max(insets.bottom, 22) },
          sheet,
        ]}
      >
        <View style={s.grabber} />
        <Text style={s.headline}>Your Billion is ready.</Text>

        <View style={s.list}>
          {lines.map((line) => (
            <Text key={line} style={s.item}>
              {line}
            </Text>
          ))}
        </View>
        <Text style={s.signals}>
          {signals} signals selected for your briefing.
        </Text>

        <Text style={s.save}>Save your workspace</Text>

        <Pressable
          style={s.provider}
          onPress={comingSoon}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          <Text style={s.providerText}>Continue with Apple</Text>
        </Pressable>
        <Pressable
          style={s.provider}
          onPress={comingSoon}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Text style={s.providerText}>Continue with Google</Text>
        </Pressable>
        <Pressable
          style={s.provider}
          onPress={comingSoon}
          accessibilityRole="button"
          accessibilityLabel="Continue with Email"
        >
          <Text style={s.providerText}>Continue with Email</Text>
        </Pressable>

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Explore first without an account"
          testID="claim-explore"
          style={s.explore}
        >
          <Text style={s.exploreText}>Explore first</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 60,
    elevation: 60,
  },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(14,21,48,0.28)",
  },
  sheet: {
    backgroundColor: PAPER,
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22,19,26,0.14)",
    marginBottom: 22,
  },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: INK,
  },
  list: { marginTop: 22, gap: 6 },
  item: {
    fontFamily: fontDisplay.regular,
    fontSize: 18,
    color: INK,
  },
  signals: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: "rgba(22,19,26,0.5)",
    marginTop: 14,
  },
  save: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: GOLD,
    marginTop: 28,
    marginBottom: 14,
  },
  provider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,19,26,0.12)",
    paddingVertical: 14,
  },
  providerText: {
    fontFamily: fontBody.medium,
    fontSize: 16,
    color: INK,
  },
  explore: { alignItems: "center", paddingVertical: 18, marginTop: 8 },
  exploreText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: "rgba(22,19,26,0.45)",
  },
});
