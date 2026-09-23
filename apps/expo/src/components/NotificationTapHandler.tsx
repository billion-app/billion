/**
 * Opens the route carried by an OS notification tap.
 * No in-app overlay — lock screen is the popup; inside is a normal push.
 */
import type { Href } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import {
  presentationFor,
  registerSignalCategory,
} from "~/utils/local-notification";
import { hrefFromNotificationData } from "~/utils/notification-href";

Notifications.setNotificationHandler({
  handleNotification: (notification) =>
    Promise.resolve(presentationFor(notification.request.content.data)),
});
void registerSignalCategory();

export function NotificationTapHandler() {
  const router = useRouter();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    // Expo Notifications does not implement response history on web. Native
    // notification taps are the only events this component needs to handle.
    if (Platform.OS === "web") return;

    const open = (identifier: string, data: unknown) => {
      if (lastId.current === identifier) return;
      const href = hrefFromNotificationData(data);
      if (!href) return;
      lastId.current = identifier;
      router.push(href as Href);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        open(
          response.notification.request.identifier,
          response.notification.request.content.data,
        );
      },
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      open(
        response.notification.request.identifier,
        response.notification.request.content.data,
      );
    });

    return () => sub.remove();
  }, [router]);

  return null;
}
