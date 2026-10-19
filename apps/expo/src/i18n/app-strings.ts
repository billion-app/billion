/**
 * App interface text for every screen outside the article reader.
 *
 * The reader keeps its dictionary in `strings.ts`. This catalog is merged
 * from domain files under `./app`, and each entry carries all three
 * languages, so a missing translation is a type error rather than a silent
 * English fallback.
 *
 * Only Billion-authored interface copy belongs here. Official ballot text,
 * names, addresses, source titles, and API-generated content are displayed as
 * received; screens say so where a reader could mistake them for translated
 * text.
 */
import type { Catalog, Phrase } from "./app/types";
import type { AppLanguage } from "./language";
import { auditStrings } from "./app/audit";
import { ballotStrings } from "./app/ballot";
import { commonStrings } from "./app/common";
import { electionStrings } from "./app/elections";
import { feedStrings } from "./app/feed";
import { voteGuideStrings } from "./app/how-to-vote-guide";
import { howToVoteLookupStrings } from "./app/how-to-vote-lookup";
import { onboardingStrings } from "./app/onboarding";
import { pageStrings } from "./app/pages";
import { settingsStrings } from "./app/settings";
import { updateStrings } from "./app/updates";
import { votingStrings } from "./app/voting";
import { formatNumber } from "./format";

export const CATALOG = {
  ...auditStrings,
  ...updateStrings,
  ...pageStrings,
  ...commonStrings,
  ...feedStrings,
  ...electionStrings,
  ...ballotStrings,
  ...votingStrings,
  ...voteGuideStrings,
  ...howToVoteLookupStrings,
  ...settingsStrings,
  ...onboardingStrings,
} satisfies Catalog;

export type AppStringKey = keyof typeof CATALOG;

/**
 * Interpolation values. Numbers are formatted for the language (grouping
 * separators), so pass years, ZIP codes, and identifiers as strings.
 */
export type AppVars = Record<string, string | number>;

export type AppTranslate = (key: AppStringKey, vars?: AppVars) => string;

export function hasAppString(key: string): key is AppStringKey {
  return key in CATALOG;
}

/** CLDR cardinal categories for the shipped languages: zh has no plural. */
function pickPhrase(language: AppLanguage, phrase: Phrase, vars?: AppVars) {
  if (typeof phrase === "string") return phrase;
  const count = Number(vars?.count ?? 0);
  if (language === "zh") return phrase.other;
  return count === 1 ? phrase.one : phrase.other;
}

export function translateApp(
  language: AppLanguage,
  key: AppStringKey,
  vars?: AppVars,
): string {
  const entry: Record<AppLanguage, Phrase> = CATALOG[key];
  const text = pickPhrase(language, entry[language], vars);
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in vars)) return match;
    const value = vars[name];
    return typeof value === "number"
      ? formatNumber(language, value)
      : String(value);
  });
}

/** A `t` bound to one language, for utilities that take explicit language. */
export function appTranslator(language: AppLanguage): AppTranslate {
  return (key, vars) => translateApp(language, key, vars);
}

/** Known application labels from structured server metadata; unknown source labels retain their identity. */
export function translateAppLabel(
  language: AppLanguage,
  value: string,
): string {
  return hasAppString(value) ? translateApp(language, value) : value;
}
