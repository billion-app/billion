/**
 * Register this phone with the API so follow alerts can arrive as OS pushes.
 *
 * Saving stays on-device. This module copies the saved ids + notification
 * prefs to the server, keyed by the Expo push token — there is no account.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import * as Notifications from "expo-notifications";

import type { NotificationPrefs } from "./notification-prefs";
import { trpcClient } from "./api";

let token: string | null = null;

export function getPushToken(): string | null {
  return token;
}

function projectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId
  );
}

export async function ensurePushToken(): Promise<string | null> {
  if (token) return token;
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    status = asked.status;
  }
  if (status !== Notifications.PermissionStatus.GRANTED) return null;

  const easProjectId = projectId();
  if (!easProjectId) return null;

  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId,
    });
    token = result.data;
    return token;
  } catch (error) {
    console.warn("[billion] Expo push token unavailable", error);
    return null;
  }
}

export async function syncPushRegistration(
  prefs: Pick<
    NotificationPrefs,
    | "breaking"
    | "following"
    | "brief"
    | "recap"
    | "quietHours"
    | "quietStartMin"
    | "quietEndMin"
  >,
  followIds: readonly string[],
): Promise<void> {
  const next = await ensurePushToken();
  if (!next) return;

  const timezone =
    Localization.getCalendars()[0].timeZone ?? "America/Los_Angeles";

  try {
    await trpcClient.notifications.sync.mutate({
      token: next,
      platform: Platform.OS === "android" ? "android" : "ios",
      timezone,
      prefs: {
        breaking: prefs.breaking,
        following: prefs.following,
        brief: prefs.brief,
        recap: prefs.recap,
        quietHours: prefs.quietHours,
        quietStartMin: prefs.quietStartMin,
        quietEndMin: prefs.quietEndMin,
      },
      followIds: [...followIds],
    });
  } catch (error: unknown) {
    console.warn("[billion] push sync failed", error);
  }
}
