import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";
import { formatDate } from "~/i18n/format";

/** Format the age of a legislative action using the feed's day-level copy. */
export function relativeActivity(
  value: Date | undefined,
  now = Date.now(),
  language: AppLanguage = "en",
): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const elapsedDays = Math.floor(
    Math.max(0, now - date.getTime()) / 86_400_000,
  );
  if (elapsedDays === 0) return translateApp(language, "relative.today");
  if (elapsedDays < 30) {
    return translateApp(language, "relative.daysAgo", { count: elapsedDays });
  }
  return formatDate(language, date, { month: "short", day: "numeric" });
}
