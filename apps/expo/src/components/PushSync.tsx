/**
 * Keeps this phone registered for lock-screen alerts.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useNotificationPrefs } from "~/hooks/useNotificationPrefs";
import { useSavedContent } from "~/hooks/useSavedContent";
import { syncPushRegistration } from "~/utils/push-sync";

export function PushSync() {
  const prefs = useNotificationPrefs();
  const { savedIds } = useSavedContent();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prefs.isLoading) return;
    if (timer.current) clearTimeout(timer.current);
    const payload = {
      breaking: prefs.breaking,
      following: prefs.following,
      brief: prefs.brief,
      recap: prefs.recap,
      quietHours: prefs.quietHours,
      quietStartMin: prefs.quietStartMin,
      quietEndMin: prefs.quietEndMin,
    };
    timer.current = setTimeout(() => {
      void syncPushRegistration(payload, savedIds);
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    prefs.isLoading,
    prefs.breaking,
    prefs.following,
    prefs.brief,
    prefs.recap,
    prefs.quietHours,
    prefs.quietStartMin,
    prefs.quietEndMin,
    savedIds,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || prefs.isLoading) return;
      void syncPushRegistration(
        {
          breaking: prefs.breaking,
          following: prefs.following,
          brief: prefs.brief,
          recap: prefs.recap,
          quietHours: prefs.quietHours,
          quietStartMin: prefs.quietStartMin,
          quietEndMin: prefs.quietEndMin,
        },
        savedIds,
      );
    });
    return () => sub.remove();
  }, [
    prefs.isLoading,
    prefs.breaking,
    prefs.following,
    prefs.brief,
    prefs.recap,
    prefs.quietHours,
    prefs.quietStartMin,
    prefs.quietEndMin,
    savedIds,
  ]);

  return null;
}
