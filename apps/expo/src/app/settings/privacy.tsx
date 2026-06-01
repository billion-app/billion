import { useState } from "react";
import { Alert, Share, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePostHog } from "posthog-react-native";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { Card, GhostButton, Icon, ScreenShell, Toggle } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { queryClient, trpc } from "~/utils/api";

type Key = "location" | "personalize" | "analytics" | "crash" | "offline";

const ROWS: { k: Key; icon: IconName; label: string; sub: string }[] = [
  {
    k: "location",
    icon: "pin",
    label: "Location access",
    sub: "Used only to load your local ballot",
  },
  {
    k: "personalize",
    icon: "sliders",
    label: "Personalized feed",
    sub: "Tailor content to your interests",
  },
  {
    k: "analytics",
    icon: "layers",
    label: "Usage analytics",
    sub: "Share anonymous app usage",
  },
  {
    k: "crash",
    icon: "shield",
    label: "Crash reports",
    sub: "Send diagnostics automatically",
  },
  {
    k: "offline",
    icon: "download",
    label: "Offline downloads",
    sub: "Save articles for offline reading",
  },
];

const DEFAULTS: Record<Key, boolean> = {
  location: true,
  personalize: true,
  analytics: false,
  crash: true,
  offline: true,
};

export default function PrivacyScreen() {
  const posthog = usePostHog();
  const settingsQuery = useQuery(trpc.user.getSettings.queryOptions());
  const updateMutation = useMutation({
    ...trpc.user.updateSettings.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.user.getSettings.queryKey(),
      });
    },
  });

  const [state, setState] = useState<Record<Key, boolean>>(DEFAULTS);
  const [synced, setSynced] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (settingsQuery.data && !synced) {
    setState({
      location: settingsQuery.data.location,
      personalize: settingsQuery.data.personalize,
      analytics: settingsQuery.data.analytics,
      crash: settingsQuery.data.crash,
      offline: settingsQuery.data.offline,
    });
    setSynced(true);
  }

  const toggle = async (k: Key) => {
    const newVal = !state[k];
    setState((p) => ({ ...p, [k]: newVal }));

    // Requesting location on the OS level when enabling the location toggle.
    if (k === "location" && newVal) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          "Location permission denied",
          "Enable location access in Settings to load your local ballot.",
        );
        setState((p) => ({ ...p, location: false }));
        updateMutation.mutate({ location: false });
        return;
      }
    }

    // Reflect the analytics preference in PostHog so the SDK respects opt-out.
    if (k === "analytics") {
      if (newVal) {
        void posthog.optIn();
      } else {
        void posthog.optOut();
      }
    }

    updateMutation.mutate({ [k]: newVal });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await queryClient.fetchQuery(
        trpc.user.requestDataExport.queryOptions(),
      );
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch {
      Alert.alert("Export failed", "Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell title="Privacy">
      <View style={s.notice}>
        <Icon name="lock" size={20} color={colors.green[500]} />
        <Text style={s.noticeText}>
          Your reading history never leaves your device. You control everything
          below.
        </Text>
      </View>

      <Card flush>
        {ROWS.map((r, i) => (
          <View key={r.k} style={[s.row, i < ROWS.length - 1 && s.divider]}>
            <View style={s.tile}>
              <Icon name={r.icon} size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{r.label}</Text>
              <Text style={s.sub}>{r.sub}</Text>
            </View>
            <Toggle on={state[r.k]} onChange={() => void toggle(r.k)} />
          </View>
        ))}
      </Card>

      <GhostButton
        label={exporting ? "Preparing…" : "Download my data"}
        style={{ marginTop: 20, alignSelf: "flex-start" }}
        onPress={() => void handleExport()}
      />
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  notice: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    padding: 15,
    marginBottom: 22,
  },
  noticeText: {
    flex: 1,
    fontFamily: "AlbertSans-Regular",
    fontSize: 13.5,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: hair[1] },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fontBody.semibold, fontSize: 14.5, color: colors.white },
  sub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
