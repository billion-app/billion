/**
 * Device-local notification preferences.
 *
 * Delivery: the phone registers an Expo push token; the API stores prefs
 * and follows, and `notify-followers` sends lock-screen alerts. These
 * toggles are the reader's intent. Settings is the control panel;
 * onboarding is the first pick. The two stay in sync through the hook
 * that writes both stores.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "billion.notification-prefs.v1";

const MINUTES_IN_DAY = 24 * 60;

export interface NotificationPrefs {
  /** Rare, human-reviewed BREAKING. Default on. */
  breaking: boolean;
  /** Bills, elections, courts, topics the reader asked us to watch. */
  following: boolean;
  /** Opt-in morning summary. Default off. */
  brief: boolean;
  /** Opt-in evening recap. Default off until onboarding says otherwise. */
  recap: boolean;
  quietHours: boolean;
  /** Minutes from local midnight, 0–1439. Default 10:00 PM. */
  quietStartMin: number;
  /** Minutes from local midnight. Default 7:00 AM. */
  quietEndMin: number;
  /**
   * True after the first save, or after copying cadence from onboarding.
   * False on disk means "never opened Settings" — hydrate from onboarding.
   */
  settled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  breaking: true,
  following: true,
  brief: false,
  recap: false,
  quietHours: true,
  quietStartMin: 22 * 60,
  quietEndMin: 7 * 60,
  settled: false,
};

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return ((rounded % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
}

export function stepHour(minutes: number, deltaHours: number): number {
  return clampMinutes(minutes + deltaHours * 60);
}

export function formatClock(totalMin: number): string {
  const min = clampMinutes(totalMin);
  const hour24 = Math.floor(min / 60);
  const minute = min % 60;
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function quietHoursLabel(prefs: NotificationPrefs): string {
  return `${formatClock(prefs.quietStartMin)} \u2013 ${formatClock(prefs.quietEndMin)}`;
}

/**
 * Overnight windows (10 PM – 7 AM) are the usual case. A zero-length
 * window (start === end) is treated as never quiet, not always quiet.
 */
export function inQuietHours(
  at: Date,
  prefs: Pick<
    NotificationPrefs,
    "quietHours" | "quietStartMin" | "quietEndMin"
  >,
): boolean {
  if (!prefs.quietHours) return false;
  const start = clampMinutes(prefs.quietStartMin);
  const end = clampMinutes(prefs.quietEndMin);
  if (start === end) return false;
  const minutes = at.getHours() * 60 + at.getMinutes();
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

/** When the OS should actually deliver, honoring quiet hours. */
export function nextDeliveryAt(
  at: Date,
  prefs: Pick<
    NotificationPrefs,
    "quietHours" | "quietStartMin" | "quietEndMin"
  >,
): Date {
  if (!inQuietHours(at, prefs)) return new Date(at.getTime());
  const end = new Date(at.getTime());
  const hour = Math.floor(clampMinutes(prefs.quietEndMin) / 60);
  const minute = clampMinutes(prefs.quietEndMin) % 60;
  end.setHours(hour, minute, 0, 0);
  if (end.getTime() <= at.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}

export function parseNotificationPrefs(raw: string | null): NotificationPrefs {
  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      breaking: parsed.breaking !== false,
      following: parsed.following !== false,
      brief: parsed.brief === true,
      recap: parsed.recap === true,
      quietHours: parsed.quietHours !== false,
      quietStartMin: clampMinutes(
        parsed.quietStartMin ?? DEFAULT_NOTIFICATION_PREFS.quietStartMin,
      ),
      quietEndMin: clampMinutes(
        parsed.quietEndMin ?? DEFAULT_NOTIFICATION_PREFS.quietEndMin,
      ),
      settled: parsed.settled === true,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    return parseNotificationPrefs(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* a dropped preference is not worth interrupting settings for */
  }
}
