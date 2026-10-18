export function daysUntil(dateString: string): number {
  const now = new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const calendar = new Date(dateString);
    const targetDay = Date.UTC(
      calendar.getUTCFullYear(),
      calendar.getUTCMonth(),
      calendar.getUTCDate(),
    );
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((targetDay - today) / 86400000);
  }
  const target = new Date(dateString);
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function formatDate(dateString: string, locale = "en-US"): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? { timeZone: "UTC" } : {}),
  });
}

export function isWithinDays(dateString: string, days: number): boolean {
  const daysRemaining = daysUntil(dateString);
  return daysRemaining > 0 && daysRemaining <= days;
}

/** Short "Nov 4" style label. */
export function monthDay(dateString: string, locale = "en-US"): string {
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? { timeZone: "UTC" } : {}),
  });
}
