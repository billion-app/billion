import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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
  planes,
  rd,
  useTheme,
} from "~/styles";
import { restartWithLatestUpdate } from "~/utils/restart-with-update";
import {
  resolveUpdatePrompt,
  shouldForceShowBanner,
} from "~/utils/update-prompt";

export interface UpdatePromptProps {
  forceShow?: boolean;
}

/** Optional updates remain dismissible, including while a download is pending. */
export function UpdatePrompt({ forceShow = false }: UpdatePromptProps) {
  const { t } = useAppTranslation();
  const { currentlyRunning, downloadedUpdate, isUpdatePending } =
    Updates.useUpdates();
  const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(
    null,
  );
  const [preparing, setPreparing] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const forcePreview = shouldForceShowBanner({
    forceShowProp: forceShow,
    isDev: __DEV__,
    forceEnv: process.env.EXPO_PUBLIC_FORCE_UPDATE_BANNER,
  });
  const { visible, updateId } = resolveUpdatePrompt({
    forcePreview,
    updatesEnabled: Updates.isEnabled,
    isUpdatePending,
    currentlyRunningUpdateId: currentlyRunning.updateId,
    downloadedUpdate,
    dismissedUpdateId,
  });
  useEffect(
    () => () => {
      operation.current?.abort();
      operation.current = null;
    },
    [],
  );

  const dismiss = () => {
    operation.current?.abort();
    operation.current = null;
    setPreparing(false);
    setDismissedUpdateId(updateId);
  };
  const restart = async () => {
    if (operation.current) return;
    if (forcePreview) {
      dismiss();
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setPreparing(true);
    try {
      await restartWithLatestUpdate(Updates, controller.signal);
      if (!controller.signal.aborted) setDismissedUpdateId(updateId);
    } catch {
      if (!controller.signal.aborted)
        Alert.alert(t("update.failedTitle"), t("update.failedBody"));
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setPreparing(false);
      }
    }
  };
  return (
    <>
      {(visible || preparing) && (
        <UpdatePromptCard
          busy={preparing}
          onRestart={() => void restart()}
          onDismiss={dismiss}
        />
      )}
      <AppStoreUpdateBanner otaVisible={visible || preparing} />
    </>
  );
}

/** Shared with the development preview so ready and slow-download states can be exercised. */
export function UpdatePromptCard({
  busy,
  onRestart,
  onDismiss,
}: {
  busy: boolean;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  const { theme, isDark } = useTheme();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={s.root}>
      <View
        style={[
          s.card,
          {
            bottom: insets.bottom + 88,
            backgroundColor: isDark ? planes.surface : theme.card,
            borderColor: theme.border,
          },
          getShadow("lg", isDark),
        ]}
      >
        <View style={s.heading} testID="ota-update-card">
          <UpdateReadyMark size={32} color={colors.bill} />
          <View
            style={s.copy}
            accessibilityLiveRegion="polite"
            accessibilityState={{ busy }}
          >
            <Text style={s.kicker}>{t("update.kicker")}</Text>
            <Text style={[s.title, { color: theme.foreground }]}>
              {busy ? t("update.getting") : t("update.ready")}
            </Text>
            <Text style={[s.subtitle, { color: theme.textSecondary }]}>
              {busy
                ? t("update.restartingWhenReady")
                : t("update.restartToInstall")}
            </Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable
            testID="ota-restart"
            accessibilityRole="button"
            accessibilityLabel={t("update.restartA11y")}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={onRestart}
            style={({ pressed }) => [
              s.action,
              s.primary,
              busy && s.disabled,
              pressed && s.pressed,
            ]}
          >
            <Text style={s.primaryText}>
              {busy ? t("update.updating") : t("update.restart")}
            </Text>
          </Pressable>
          <Pressable
            testID="ota-dismiss"
            accessibilityRole="button"
            accessibilityLabel={t("update.dismissA11y")}
            onPress={onDismiss}
            style={({ pressed }) => [s.action, pressed && s.pressed]}
          >
            <Text style={[s.secondaryText, { color: theme.foreground }]}>
              {t("update.notNow")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 1000 },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    padding: 16,
    gap: 12,
    borderRadius: rd.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  kicker: {
    color: colors.bill,
    fontFamily: fontBody.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: { fontFamily: fontDisplay.bold, fontSize: 18, lineHeight: 24 },
  subtitle: { fontFamily: fontBody.regular, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  primary: { backgroundColor: colors.bill },
  primaryText: {
    color: planes.ink,
    fontFamily: fontBody.semibold,
    fontSize: 14,
  },
  secondaryText: { fontFamily: fontBody.semibold, fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
