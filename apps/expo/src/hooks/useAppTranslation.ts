/**
 * App interface translation, reactive to the reader's language.
 *
 * Reads the language from `useLanguage`, so every screen re-renders in place
 * when Settings → Language changes; nothing remounts.
 */
import { useMemo } from "react";

import type { AppLanguage } from "~/i18n/language";
import { appTranslator } from "~/i18n/app-strings";
import {
  formatCurrency,
  formatDate,
  formatList,
  formatNumber,
  formatPercent,
  formatTime,
  localeTag,
} from "~/i18n/format";
import { useLanguage } from "./useLanguage";

function bind(language: AppLanguage) {
  return {
    language,
    locale: localeTag(language),
    t: appTranslator(language),
    formatDate: (
      value: string | number | Date,
      options?: Intl.DateTimeFormatOptions,
      flags?: { calendar?: boolean },
    ) => formatDate(language, value, options, flags),
    formatTime: (
      value: string | number | Date,
      options?: Intl.DateTimeFormatOptions,
    ) => formatTime(language, value, options),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(language, value, options),
    formatCurrency: (value: number, options?: Intl.NumberFormatOptions) =>
      formatCurrency(language, value, options),
    formatPercent: (ratio: number, options?: Intl.NumberFormatOptions) =>
      formatPercent(language, ratio, options),
    formatList: (items: string[]) => formatList(language, items),
  };
}

export type AppTranslation = ReturnType<typeof bind>;

export function useAppTranslation(): AppTranslation {
  const { language } = useLanguage();
  return useMemo(() => bind(language), [language]);
}
