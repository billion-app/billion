import type { Href } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { trpcClient } from "~/utils/api";
import {
  getBreakingNewsPreference,
  getExistingExpoPushToken,
  getLastExpoPushToken,
} from "~/utils/push-notifications";

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export function PushNotificationObserver() {
  const router = useRouter();
  const openedNotificationId = useRef<string | null>(null);

  useEffect(() => {
    const openNotification = (response: Notifications.NotificationResponse) => {
      const notificationId = response.notification.request.identifier;
      if (openedNotificationId.current === notificationId) return;
      openedNotificationId.current = notificationId;

      const route = response.notification.request.content.data?.route;
      if (
        typeof route === "string" &&
        route.startsWith("/") &&
        !route.startsWith("//")
      ) {
        router.push(route as Href);
      }
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openNotification(response);
      void Notifications.clearLastNotificationResponseAsync();
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;

    void Promise.all([
      getExistingExpoPushToken(),
      getLastExpoPushToken(),
      getBreakingNewsPreference(),
    ])
      .then(async ([currentToken, lastToken, breakingNews]) => {
        const expoPushToken = currentToken ?? lastToken;
        if (!expoPushToken) return;
        const platform = Platform.OS === "android" ? "android" : "ios";

        if (breakingNews && currentToken) {
          await trpcClient.notifications.registerDevice.mutate({
            expoPushToken,
            platform,
          });
        } else {
          await trpcClient.notifications.refreshDevice.mutate({
            expoPushToken,
            platform,
          });
          await trpcClient.notifications.setBreakingNews.mutate({
            expoPushToken,
            enabled: false,
          });
        }
      })
      .catch((error: unknown) => {
        console.warn("Could not synchronize push notification token", error);
      });
  }, []);

  return null;
}
