import { useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, ScreenShell, Toggle } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpcClient } from "~/utils/api";
import {
  getBreakingNewsPreference,
  getExistingExpoPushToken,
  getLastExpoPushToken,
  requestExpoPushToken,
  setBreakingNewsPreference,
} from "~/utils/push-notifications";

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const registerMutation = useMutation({
    mutationFn: (expoPushToken: string) =>
      trpcClient.notifications.registerDevice.mutate({
        expoPushToken,
        platform: Platform.OS === "android" ? "android" : "ios",
      }),
  });
  const preferenceMutation = useMutation({
    mutationFn: ({
      expoPushToken,
      next,
    }: {
      expoPushToken: string;
      next: boolean;
    }) =>
      trpcClient.notifications.setBreakingNews.mutate({
        expoPushToken,
        enabled: next,
      }),
  });

  useEffect(() => {
    void Promise.all([
      getBreakingNewsPreference(),
      getExistingExpoPushToken(),
      getLastExpoPushToken(),
    ])
      .then(async ([preference, currentToken, lastToken]) => {
        const active = preference && Boolean(currentToken);
        if (preference && !active) {
          await setBreakingNewsPreference(false);
          if (lastToken) {
            await trpcClient.notifications.setBreakingNews.mutate({
              expoPushToken: lastToken,
              enabled: false,
            });
          }
        }
        setEnabled(active);
      })
      .catch((error: unknown) => {
        console.warn("Could not load notification preference", error);
      })
      .finally(() => setReady(true));
  }, []);

  const updatePreference = async (next: boolean) => {
    if (saving || !ready) return;
    setSaving(true);

    try {
      if (next) {
        const expoPushToken = await requestExpoPushToken();
        if (!expoPushToken) {
          await setBreakingNewsPreference(false);
          setEnabled(false);
          Alert.alert(
            "Notifications are off",
            "Enable notifications for Billion in Settings to receive breaking news.",
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => void Linking.openSettings(),
              },
            ],
          );
          return;
        }

        await registerMutation.mutateAsync(expoPushToken);
        await setBreakingNewsPreference(true);
        setEnabled(true);
      } else {
        await setBreakingNewsPreference(false);
        setEnabled(false);
        const expoPushToken =
          (await getExistingExpoPushToken()) ?? (await getLastExpoPushToken());
        if (expoPushToken) {
          await preferenceMutation.mutateAsync({
            expoPushToken,
            next: false,
          });
        }
      }

      posthog.capture("breaking_news_preference_updated", { enabled: next });
    } catch (error) {
      console.warn("Could not update notification preference", error);
      Alert.alert(
        "Couldn’t update notifications",
        next
          ? "Please check your connection and try again."
          : "Alerts are off on this device. Billion will retry the server update next time the app opens.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell title="Notifications">
      <Text style={s.intro}>
        Choose which updates can interrupt your day. Billion will keep these
        alerts rare and editorially reviewed.
      </Text>

      <Kicker>News alerts</Kicker>
      <Card flush>
        <View style={s.row}>
          <View style={s.tile}>
            <Icon name="bell" size={18} color={colors.white} />
          </View>
          <View style={s.copy}>
            <Text style={s.label}>Breaking legislation</Text>
            <Text style={s.sub}>
              Major bill introductions, votes, signatures, and vetoes.
            </Text>
          </View>
          <Toggle
            on={ready && enabled}
            onChange={(next) => void updatePreference(next)}
          />
        </View>
      </Card>

      <View style={s.note}>
        <Icon name="info" size={17} color={colors.textSecondary} />
        <Text style={s.noteText}>
          Your phone’s system settings always take precedence. Billion never
          uses Apple’s mute-bypassing Critical Alerts.
        </Text>
      </View>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  sub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: hair[1],
    marginTop: 22,
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    fontFamily: "AlbertSans-Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
