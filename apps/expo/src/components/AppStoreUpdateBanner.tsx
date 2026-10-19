import { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeApplicationVersion } from "expo-application";
import * as Updates from "expo-updates";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "~/components/ui/Icon";
import { useOnboarding } from "~/hooks/useOnboarding";
import {
  digest,
  DigestHair,
  DigestRadii,
  fontBody,
  fontDisplay,
  getShadow,
  planes,
} from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { shouldShowAppStoreUpdate } from "~/utils/app-store-update";
import {
  resolveUpdatePrompt,
  shouldForceShowBanner,
} from "~/utils/update-prompt";

const releaseQuery = trpc.appRelease.latestIos.queryOptions(undefined, {
  staleTime: 60 * 60 * 1000,
  retry: false,
});

export function AppStoreUpdateBanner() {
  const { completed } = useOnboarding();
  const enabled = Platform.OS === "ios" && !__DEV__ && completed;
  const { data: release } = useQuery({ ...releaseQuery, enabled });
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const { currentlyRunning, downloadedUpdate, isUpdatePending } =
    Updates.useUpdates();
  const { visible: otaVisible } = resolveUpdatePrompt({
    forcePreview: shouldForceShowBanner({
      isDev: __DEV__,
      forceEnv: process.env.EXPO_PUBLIC_FORCE_UPDATE_BANNER,
    }),
    updatesEnabled: Updates.isEnabled,
    isUpdatePending,
    currentlyRunningUpdateId: currentlyRunning.updateId,
    downloadedUpdate,
    dismissedUpdateId: null,
  });

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // fetchQuery reuses fresh data and deduplicates concurrent checks.
        void queryClient.fetchQuery(releaseQuery).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  if (
    !enabled ||
    !release ||
    !shouldShowAppStoreUpdate({
      installedVersion: nativeApplicationVersion,
      systemVersion: String(Platform.Version),
      release,
      dismissedVersion,
      otaVisible,
    })
  )
    return null;

  const openStore = async () => {
    try {
      await Linking.openURL(release.url);
      setDismissedVersion(release.version);
    } catch {
      Alert.alert(
        "Unable to open App Store",
        "Please try again, or search for Billion in the App Store.",
      );
    }
  };

  return (
    <AppStoreUpdateCard
      version={release.version}
      onOpen={() => void openStore()}
      onDismiss={() => setDismissedVersion(release.version)}
    />
  );
}

export function AppStoreUpdateCard({
  version,
  onOpen,
  onDismiss,
}: {
  version: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View
        style={[styles.card, { top: insets.top + 8 }, getShadow("lg", true)]}
      >
        <View style={styles.heading}>
          <View
            style={styles.iconTile}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="download" size={22} color={planes.paper} />
          </View>
          <View
            style={styles.copy}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={styles.title}>An update is here</Text>
            <Text style={styles.subtitle}>Billion {version} · App Store</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open Billion in the App Store"
            onPress={onOpen}
            style={({ pressed }) => [
              styles.action,
              styles.primaryAction,
              pressed && styles.primaryPressed,
            ]}
          >
            <Text style={styles.primaryText}>Open App Store</Text>
            <View
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="external" size={15} color={planes.ink} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss App Store update for this session"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.action,
              styles.laterAction,
              pressed && styles.laterPressed,
            ]}
          >
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 999 },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    padding: 16,
    backgroundColor: planes.paper,
    borderRadius: DigestRadii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.inkBorder,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: planes.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 20,
    lineHeight: 26,
    color: digest.inkOnPaper,
  },
  subtitle: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 18,
    color: DigestHair.inkSecondary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  action: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAction: {
    flexGrow: 1,
    maxWidth: "100%",
    flexDirection: "row",
    gap: 8,
    backgroundColor: digest.primary,
  },
  primaryText: {
    flexShrink: 1,
    textAlign: "center",
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: planes.ink,
  },
  laterAction: { minWidth: 64 },
  laterText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: DigestHair.inkSecondary,
  },
  primaryPressed: { opacity: 0.8 },
  laterPressed: { backgroundColor: DigestHair.inkFaint },
});
