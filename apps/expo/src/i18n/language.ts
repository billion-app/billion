/**
 * The reader's chosen language. Pure: the stored preference lives in
 * `~/hooks/useLanguage`, and the device locale is passed in.
 */

export const APP_LANGUAGES = ["en", "es", "zh"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const LANGUAGE_OPTIONS: {
  id: AppLanguage;
  /** The language's own name, so a reader who cannot read English finds it. */
  nativeName: string;
  englishName: string;
}[] = [
  { id: "en", nativeName: "English", englishName: "English" },
  { id: "es", nativeName: "Español", englishName: "Spanish" },
  { id: "zh", nativeName: "中文（简体）", englishName: "Chinese (Simplified)" },
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (
    typeof value === "string" &&
    (APP_LANGUAGES as readonly string[]).includes(value)
  );
}

/**
 * The first supported language in the device's preference order, or English.
 * Accepts BCP-47 tags such as `es-MX`, `zh-Hans-CN`, or `zh-TW`.
 */
export function languageFromLocales(tags: readonly string[]): AppLanguage {
  for (const tag of tags) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isAppLanguage(base)) return base;
  }
  return "en";
}

/** BCP-47 tag handed to the speech engine for voice selection. */
export function speechLanguageTag(language: AppLanguage): string {
  switch (language) {
    case "es":
      return "es-US";
    case "zh":
      return "zh-CN";
    default:
      return "en-US";
  }
}
