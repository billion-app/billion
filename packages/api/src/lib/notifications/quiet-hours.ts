const MINUTES_IN_DAY = 24 * 60;

export interface QuietWindow {
  quietHours: boolean;
  quietStartMin: number;
  quietEndMin: number;
  timezone: string;
}

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return ((rounded % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
}

function minutesInZone(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(
      parts.find((part) => part.type === "minute")?.value ?? 0,
    );
    return hour * 60 + minute;
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

export function inQuietHours(at: Date, prefs: QuietWindow): boolean {
  if (!prefs.quietHours) return false;
  const start = clampMinutes(prefs.quietStartMin);
  const end = clampMinutes(prefs.quietEndMin);
  if (start === end) return false;
  const minutes = minutesInZone(at, prefs.timezone);
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

/** When the OS should actually deliver, honoring the device's quiet window. */
export function nextDeliveryAt(at: Date, prefs: QuietWindow): Date {
  if (!inQuietHours(at, prefs)) return new Date(at.getTime());
  const cursor = new Date(at.getTime());
  cursor.setUTCSeconds(0, 0);
  for (let i = 0; i < 24 * 60 + 2; i++) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    if (!inQuietHours(cursor, prefs)) return cursor;
  }
  return cursor;
}
