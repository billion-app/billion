import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";

import { AppStoreUpdateBanner } from "~/components/AppStoreUpdateBanner";
import { UpdateReadyMark } from "~/components/UpdateReadyMark";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  colors,
  fontBody,
  fontDisplay,
  getShadow,
  hair,
  planes,
  rd,
  useTheme,
} from "~/styles";
import { restartWithLatestUpdate } from "~/utils/restart-with-update";
import {
  resolveUpdatePrompt,
  shouldForceShowBanner,
} from "~/utils/update-prompt";

const TIMER_MS = 8000;
const TO_CENTER_MS = 420;

export interface UpdatePromptProps {
  /** Force banner visible for DEV / preview. */
  forceShow?: boolean;
}

type Phase = "toast" | "ask";

/** Dismissible OTA popup: toast with timer, then centered ask. */
export function UpdatePrompt({ forceShow = false }: UpdatePromptProps) {
  const { theme, isDark } = useTheme();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { currentlyRunning, downloadedUpdate, isUpdatePending } =
    Updates.useUpdates();
  const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(
    null,
  );
  const [phase, setPhase] = useState<Phase>("toast");
  const [phaseForId, setPhaseForId] = useState<string | null>(null);
  const restartInFlight = useRef(false);
  const [isPreparingUpdate, setIsPreparingUpdate] = useState(false);

  const forcePreview = shouldForceShowBanner({
    forceShowProp: forceShow,
    isDev: __DEV__,
    forceEnv: process.env.EXPO_PUBLIC_FORCE_UPDATE_BANNER,
  });
  const { visible: promptVisible, updateId } = resolveUpdatePrompt({
    forcePreview,
    updatesEnabled: Updates.isEnabled,
    isUpdatePending,
    currentlyRunningUpdateId: currentlyRunning.updateId,
    downloadedUpdate,
    dismissedUpdateId,
  });
  const visible = promptVisible || isPreparingUpdate;

  const restartWithUpdate = async () => {
    if (restartInFlight.current) return;
    if (forcePreview) {
      setDismissedUpdateId(updateId);
      return;
    }
    restartInFlight.current = true;
    setIsPreparingUpdate(true);
    try {
      await restartWithLatestUpdate(Updates);
      setDismissedUpdateId(updateId);
    } catch (error) {
      console.warn("Unable to install the latest update:", error);
      Alert.alert(t("update.failedTitle"), t("update.failedBody"));
    } finally {
      restartInFlight.current = false;
      setIsPreparingUpdate(false);
    }
  };

  // Reset phase when a new update id becomes active (render-time adjust).
  if (visible && updateId != null && phaseForId !== updateId) {
    setPhaseForId(updateId);
    setPhase(reduceMotion ? "ask" : "toast");
  }

  const enterOpacity = useSharedValue(0);
  const timerProgress = useSharedValue(1);
  /** 0 = top toast, 1 = centered ask */
  const centerProgress = useSharedValue(0);

  const dismiss = () => {
    if (restartInFlight.current) return;
    if (updateId != null) setDismissedUpdateId(updateId);
  };

  const goAsk = () => {
    setPhase("ask");
  };

  useEffect(() => {
    if (!visible) {
      enterOpacity.value = 0;
      timerProgress.value = 1;
      centerProgress.value = 0;
      return;
    }

    if (reduceMotion) {
      enterOpacity.value = 1;
      timerProgress.value = 0;
      centerProgress.value = 1;
      return;
    }

    enterOpacity.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
    centerProgress.value = 0;
    timerProgress.value = 1;
    timerProgress.value = withTiming(
      0,
      { duration: TIMER_MS, easing: Easing.linear },
      (finished) => {
        if (!finished) return;
        centerProgress.value = withTiming(1, {
          duration: TO_CENTER_MS,
          easing: Easing.inOut(Easing.cubic),
        });
        runOnJS(goAsk)();
      },
    );
  }, [
    visible,
    updateId,
    reduceMotion,
    enterOpacity,
    timerProgress,
    centerProgress,
  ]);

  const screenH = Dimensions.get("window").height;
  const toastTop = insets.top + 8;

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(centerProgress.value, [0, 1], [0, 0.55]),
  }));

  const cardStyle = useAnimatedStyle(() => {
    const topY = toastTop;
    const centerY = screenH / 2 - 140;
    const translateY = interpolate(
      centerProgress.value,
      [0, 1],
      [topY, centerY],
    );
    const scale = interpolate(centerProgress.value, [0, 1], [1, 1.02]);
    return {
      opacity: enterOpacity.value,
      transform: [{ translateY }, { scale }],
    };
  });

  const timerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(timerProgress.value, 0.001) }],
    opacity: interpolate(centerProgress.value, [0, 0.35], [1, 0]),
  }));

  const surface = isDark ? planes.surface : theme.card;
  const asking = phase === "ask";

  return (
    <>
      <AppStoreUpdateBanner otaVisible={visible} />
      {visible && (
        <View
          pointerEvents="box-none"
          style={styles.root}
          accessibilityElementsHidden={false}
          importantForAccessibility="yes"
        >
          <Animated.View
            pointerEvents={asking ? "auto" : "none"}
            style={[styles.backdrop, backdropStyle]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>

          <Animated.View
            style={[
              styles.popup,
              {
                backgroundColor: surface,
                borderColor: hair[2],
              },
              getShadow(asking ? "lg" : "md", isDark),
              cardStyle,
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {asking ? (
              <View style={styles.askBody}>
                <UpdateReadyMark size={44} color={colors.bill} />
                <Text style={styles.kicker}>{t("update.kicker")}</Text>
                <Text style={[styles.askTitle, { color: theme.foreground }]}>
                  {isPreparingUpdate
                    ? t("update.getting")
                    : t("update.askTitle")}
                </Text>
                <Text
                  style={[styles.askSubtitle, { color: theme.textSecondary }]}
                >
                  {isPreparingUpdate
                    ? t("update.restartingBody")
                    : t("update.askBody")}
                </Text>
                <View style={styles.askActions}>
                  <Pressable
                    onPress={() => void restartWithUpdate()}
                    disabled={isPreparingUpdate}
                    accessibilityState={{
                      disabled: isPreparingUpdate,
                      busy: isPreparingUpdate,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("update.restartA11y")}
                    style={({ pressed }) => [
                      styles.askPrimary,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.askPrimaryText}>
                      {isPreparingUpdate
                        ? t("update.updating")
                        : t("update.restartNow")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={dismiss}
                    disabled={isPreparingUpdate}
                    accessibilityRole="button"
                    accessibilityLabel={t("update.dismissA11y")}
                    style={({ pressed }) => [
                      styles.askSecondary,
                      pressed && { opacity: 0.55 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.askSecondaryText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {t("update.notNow")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.markWrap}>
                  <UpdateReadyMark size={32} color={colors.bill} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.kicker} numberOfLines={1}>
                    {t("update.kicker")}
                  </Text>
                  <Text
                    style={[styles.title, { color: theme.foreground }]}
                    numberOfLines={1}
                  >
                    {isPreparingUpdate
                      ? t("update.getting")
                      : t("update.ready")}
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {isPreparingUpdate
                      ? t("update.restartingWhenReady")
                      : t("update.restartToInstall")}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void restartWithUpdate()}
                    disabled={isPreparingUpdate}
                    accessibilityState={{
                      disabled: isPreparingUpdate,
                      busy: isPreparingUpdate,
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("update.restartA11y")}
                    style={({ pressed }) => [
                      styles.restartHit,
                      pressed && styles.restartPressed,
                    ]}
                  >
                    <Text style={styles.restartText}>
                      {isPreparingUpdate
                        ? t("update.updating")
                        : t("update.restart")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={dismiss}
                    disabled={isPreparingUpdate}
                    hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("update.dismissA11y")}
                    style={({ pressed }) => [
                      styles.laterHit,
                      pressed && { opacity: 0.55 },
                    ]}
                  >
                    <Text
                      style={[styles.laterText, { color: theme.textSecondary }]}
                    >
                      {t("update.later")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={[styles.timerTrack, { backgroundColor: hair[2] }]}>
              <Animated.View style={[styles.timerFill, timerStyle]} />
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  popup: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: rd.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  markWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 1,
  },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
    color: colors.bill,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingLeft: 4,
  },
  restartHit: {
    justifyContent: "center",
    minHeight: 36,
    paddingVertical: 4,
  },
  restartPressed: {
    opacity: 0.7,
  },
  restartText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.bill,
  },
  laterHit: {
    justifyContent: "center",
    minHeight: 36,
    paddingVertical: 4,
  },
  laterText: {
    fontFamily: fontBody.medium,
    fontSize: 13,
  },
  askBody: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 8,
  },
  askTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
    marginTop: 4,
  },
  askSubtitle: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  askActions: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  askPrimary: {
    backgroundColor: colors.bill,
    borderRadius: rd.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  askPrimaryText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  askSecondary: {
    paddingVertical: 10,
    alignItems: "center",
  },
  askSecondaryText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
  },
  timerTrack: {
    height: 3,
    width: "100%",
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    width: "100%",
    backgroundColor: colors.bill,
    transformOrigin: "left",
  },
});
