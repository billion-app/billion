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

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? { timeZone: "UTC" } : {}),
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isWithinDays(dateString: string, days: number): boolean {
  const daysRemaining = daysUntil(dateString);
  return daysRemaining > 0 && daysRemaining <= days;
}

/** Short "Nov 4" style label. */
export function monthDay(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? { timeZone: "UTC" } : {}),
  });
}

// NOTE: `shiftDays` used to live here. Its only callers were ElectionHero and
// KeyDatesSection, which used it to synthesize registration and vote-by-mail
// deadlines as fixed offsets from Election Day and render them as fact. Those
// dates are jurisdiction-specific and were never sourced, so both callers and
// this helper are gone. Deadlines belong to an official source or to the
// "not published" state on How to Vote — not to arithmetic.
