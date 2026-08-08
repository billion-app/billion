import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BREAKING_NEWS_KEY = "notifications.breaking-news-enabled";
const LAST_PUSH_TOKEN_KEY = "notifications.last-expo-push-token";

export async function requestExpoPushToken(): Promise<string | null> {
  if (
    !Device.isDevice ||
    (Platform.OS !== "ios" && Platform.OS !== "android")
  ) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("breaking-news", {
      name: "Breaking news",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === Notifications.PermissionStatus.GRANTED
      ? current
      : await Notifications.requestPermissionsAsync();

  if (permission.status !== Notifications.PermissionStatus.GRANTED) {
    return null;
  }

  return getExpoPushToken();
}

export async function getExistingExpoPushToken(): Promise<string | null> {
  if (
    !Device.isDevice ||
    (Platform.OS !== "ios" && Platform.OS !== "android")
  ) {
    return null;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== Notifications.PermissionStatus.GRANTED) return null;
  return getExpoPushToken();
}

export async function getBreakingNewsPreference(): Promise<boolean> {
  return (await AsyncStorage.getItem(BREAKING_NEWS_KEY)) === "true";
}

export async function setBreakingNewsPreference(enabled: boolean) {
  await AsyncStorage.setItem(BREAKING_NEWS_KEY, String(enabled));
}

export async function getLastExpoPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
}

async function getExpoPushToken(): Promise<string> {
  const extra = Constants.expoConfig?.extra as unknown;
  const easConfig = Constants.easConfig as unknown;
  const projectId =
    readProjectId(extra, "eas") ?? readProjectId(easConfig, undefined);

  if (typeof projectId !== "string" || !projectId) {
    throw new Error("Missing EAS project ID");
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;
  await AsyncStorage.setItem(LAST_PUSH_TOKEN_KEY, token);
  return token;
}

function readProjectId(
  value: unknown,
  nestedKey: string | undefined,
): string | undefined {
  if (!isRecord(value)) return undefined;
  const source = nestedKey ? value[nestedKey] : value;
  if (!isRecord(source)) return undefined;
  return typeof source.projectId === "string" ? source.projectId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
