/**
 * Locale-aware dates and numbers for the reader's app language.
 *
 * Pure: callers pass the language from `useLanguage` (or the
 * `useAppTranslation` helpers). Only `Intl.DateTimeFormat` and
 * `Intl.NumberFormat` are used because Hermes ships both.
 *
 * Calendar dates arrive as `YYYY-MM-DD`. JavaScript parses those as UTC
 * midnight, so they are formatted in UTC to keep Election Day on its printed
 * day for readers west of Greenwich. Timestamps keep the device time zone.
 */
import type { AppLanguage } from "./language";

const LOCALE_TAGS: Record<AppLanguage, string> = {
  en: "en-US",
  es: "es-US",
  zh: "zh-CN",
};

export function localeTag(language: AppLanguage): string {
  return LOCALE_TAGS[language];
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && CALENDAR_DATE.test(value);
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Format a date or timestamp. A bare `YYYY-MM-DD` string, or a caller that
 * asks for `calendar: true`, is formatted in UTC so the printed day matches
 * the official calendar day. Invalid input returns an empty string.
 */
export function formatDate(
  language: AppLanguage,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
  { calendar }: { calendar?: boolean } = {},
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const utc = calendar ?? isCalendarDate(value);
  return date.toLocaleDateString(localeTag(language), {
    ...options,
    ...(utc && !options.timeZone ? { timeZone: "UTC" } : {}),
  });
}

/** Format a clock time in the device time zone. */
export function formatTime(
  language: AppLanguage,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(localeTag(language), options);
}

export function formatNumber(
  language: AppLanguage,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeTag(language), options).format(value);
}

/** US dollars, whole by default. */
export function formatCurrency(
  language: AppLanguage,
  value: number,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 },
): string {
  return new Intl.NumberFormat(localeTag(language), {
    style: "currency",
    currency: "USD",
    ...options,
  }).format(value);
}

/** `ratio` is 0–1. */
export function formatPercent(
  language: AppLanguage,
  ratio: number,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 },
): string {
  return new Intl.NumberFormat(localeTag(language), {
    style: "percent",
    ...options,
  }).format(ratio);
}

/**
 * Join short items into a readable list ("A, B, and C"). Intl.ListFormat is
 * not available in Hermes, so the conjunctions are spelled out here.
 */
export function formatList(language: AppLanguage, items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (language === "zh") return items.join("、");
  const and = language === "es" ? "y" : "and";
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  const comma = language === "en" ? "," : "";
  return `${head}${comma} ${and} ${items[items.length - 1]}`;
}
