/**
 * Device-local OS notifications (lock screen / Notification Center).
 *
 * Compact chrome is Apple's (icon + title + body). No decorative
 * thumbnail. Long-press opens the BillionSignal card. A tap follows
 * `data.href`. Remote alerts use the same payload from the API.
 */

import type { NotificationPrefs } from "./notification-prefs";
import { formatClock, nextDeliveryAt } from "./notification-prefs";

export interface LocalAlertPayload {
  title: string;
  body: string;
  href: string;
  /** Settings test — show the OS banner even while Billion is open. */
  test?: boolean;
}

export type ScheduleLocalAlertResult =
  | { ok: true; when: Date; test?: boolean }
  | { ok: false; reason: "denied" | "unavailable"; detail?: string };

/**
 * Category id for the signal. iOS rejects `:` and `-` in category ids.
 */
export const SIGNAL_CATEGORY = "billionSignal";

/**
 * While Billion is open, do not draw a system banner over the UI.
 * Lock screen and Notification Center still get the alert; a tap
 * opens `data.href` like any other deep link.
 */
export const FOREGROUND_PRESENTATION = {
  shouldShowAlert: false,
  shouldShowBanner: false,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
} as const;

/** The Test row is supposed to show the OS popup immediately. */
export const TEST_PRESENTATION = {
  shouldShowAlert: true,
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
} as const;

/** Night plane — Android notification accent. */
export const SIGNAL_COLOR = "#0E1530";

/** Test send waits so you can Cmd+L before it lands on the lock screen. */
export const TEST_DELAY_SECONDS = 2;

interface NativeScheduler {
  scheduleNotificationAsync: (
    identifier: string,
    content: Record<string, unknown>,
    trigger: Record<string, unknown> | null,
  ) => Promise<string>;
}

interface NativePermissions {
  requestPermissionsAsync: (request: Record<string, unknown>) => Promise<{
    granted?: boolean;
    status?: string;
    ios?: { status?: number; allowsAlert?: boolean | null };
  }>;
}

function isTestPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const test = (data as { test?: unknown }).test;
  return test === true || test === "true" || test === 1;
}

export function presentationFor(data: unknown) {
  if (isTestPayload(data)) return TEST_PRESENTATION;
  return FOREGROUND_PRESENTATION;
}

/**
 * iOS already paints the app name above the title. The event line is the
 * title. No second "Billion". No decorative thumbnail.
 */
export function signalAlertContent(payload: LocalAlertPayload) {
  return {
    title: payload.title,
    body: payload.body,
    data: payload.test
      ? { href: payload.href, test: true }
      : { href: payload.href },
    categoryIdentifier: SIGNAL_CATEGORY,
    interruptionLevel: "active" as const,
    sound: false as const,
    color: SIGNAL_COLOR,
  };
}

function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function optionalNative<T>(name: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (moduleName: string) => T | null;
    };
    return requireOptionalNativeModule(name);
  } catch {
    return null;
  }
}

async function notifications() {
  try {
    return await import("expo-notifications");
  } catch (error) {
    console.warn("[billion] expo-notifications did not load", error);
    return null;
  }
}

export async function registerSignalCategory(): Promise<void> {
  const Notifications = await notifications();
  if (!Notifications?.setNotificationCategoryAsync) return;
  try {
    await Notifications.setNotificationChannelAsync("billion-signal", {
      name: "Billion",
      importance: 3,
    });
    await Notifications.setNotificationCategoryAsync(SIGNAL_CATEGORY, [], {
      previewPlaceholder: "A bill you follow moved.",
      showTitle: true,
      showSubtitle: true,
      categorySummaryFormat: "%u more from Billion.",
    });
  } catch {
    // old Dev Client / web
  }
}

function permissionGranted(permission: {
  status?: string;
  granted?: boolean;
  ios?: { status?: number; allowsAlert?: boolean | null };
}): boolean {
  if (permission.granted === true) return true;
  if (permission.status === "granted") return true;
  const iosStatus = permission.ios?.status;
  return iosStatus === 2 || iosStatus === 3;
}

async function requestAlertPermission(): Promise<
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable"; detail?: string }
> {
  const native = optionalNative<NativePermissions>(
    "ExpoNotificationPermissionsModule",
  );
  if (native?.requestPermissionsAsync) {
    try {
      const permission = await native.requestPermissionsAsync({
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      });
      if (!permissionGranted(permission)) {
        return { ok: false, reason: "denied" };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: "unavailable",
        detail: errorDetail(error),
      };
    }
  }

  const Notifications = await notifications();
  if (!Notifications?.requestPermissionsAsync) {
    return {
      ok: false,
      reason: "unavailable",
      detail: "Notification native module is missing.",
    };
  }
  try {
    const permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    if (!permissionGranted(permission)) {
      return { ok: false, reason: "denied" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "unavailable", detail: errorDetail(error) };
  }
}

async function scheduleOnNative(
  payload: LocalAlertPayload,
  trigger: Record<string, unknown> | null,
): Promise<void> {
  const scheduler = optionalNative<NativeScheduler>(
    "ExpoNotificationScheduler",
  );
  if (!scheduler?.scheduleNotificationAsync) {
    throw new Error("ExpoNotificationScheduler is not in this binary.");
  }

  await scheduler.scheduleNotificationAsync(
    `billion-${Date.now()}`,
    { ...signalAlertContent(payload) },
    trigger,
  );
}

async function scheduleOnExpo(
  payload: LocalAlertPayload,
  trigger: Record<string, unknown> | null,
): Promise<void> {
  const Notifications = await notifications();
  if (!Notifications?.scheduleNotificationAsync) {
    throw new Error("expo-notifications.scheduleNotificationAsync missing.");
  }
  await Notifications.scheduleNotificationAsync({
    content: signalAlertContent(payload),
    trigger: trigger as never,
  });
}

export async function scheduleLocalAlert(
  payload: LocalAlertPayload,
  prefs: Pick<
    NotificationPrefs,
    "quietHours" | "quietStartMin" | "quietEndMin"
  >,
  now = new Date(),
): Promise<ScheduleLocalAlertResult> {
  const permission = await requestAlertPermission();
  if (!permission.ok) return permission;

  const when = payload.test
    ? new Date(now.getTime() + TEST_DELAY_SECONDS * 1000)
    : nextDeliveryAt(now, prefs);
  const immediate = !payload.test && when.getTime() <= now.getTime() + 500;
  const trigger = immediate
    ? null
    : payload.test
      ? {
          type: "timeInterval",
          seconds: TEST_DELAY_SECONDS,
          repeats: false,
        }
      : { type: "date", timestamp: when.getTime() };

  try {
    await scheduleOnNative(payload, trigger);
    return { ok: true, when, test: payload.test };
  } catch (nativeError) {
    console.warn("[billion] native scheduler failed", nativeError);
    try {
      await scheduleOnExpo(payload, trigger);
      return { ok: true, when, test: payload.test };
    } catch (expoError) {
      console.warn("[billion] expo scheduler failed", expoError);
      return {
        ok: false,
        reason: "unavailable",
        detail: errorDetail(expoError),
      };
    }
  }
}

export function deliveryNote(
  result: ScheduleLocalAlertResult,
  prefs: Pick<NotificationPrefs, "quietEndMin">,
): string {
  if (!result.ok) {
    if (result.reason === "denied") {
      return "Notifications are off on this phone.";
    }
    if (result.detail?.includes("not in this binary")) {
      return "This Dev Client needs a rebuild before it can send alerts.";
    }
    return result.detail
      ? `Could not send the alert. ${result.detail}`
      : "This build cannot send lock-screen alerts yet.";
  }
  if (result.test) {
    return `Lock the phone (Cmd+L). It arrives in ${TEST_DELAY_SECONDS} seconds. Long-press the banner for the navy card.`;
  }
  const now = new Date();
  if (result.when.getTime() > now.getTime() + 500) {
    return `Quiet hours \u2014 it will wait until ${formatClock(prefs.quietEndMin)}.`;
  }
  return "Sent to the lock screen. Tap it to open.";
}
