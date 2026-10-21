import type { AlertItem } from "./alert-history";
import { CARD_TRANSLATION_WAIT_MS } from "./card-translation";

export interface AlertTranslationWait {
  language: string;
  sources: Set<string>;
  deadline: number;
}

export function alertTranslationWait(
  previous: AlertTranslationWait | null,
  language: string,
  items: readonly AlertItem[] | undefined,
  now: number,
): AlertTranslationWait | null {
  const sources = (items ?? [])
    .filter((item) => item.translationState === "pending")
    .map((item) => JSON.stringify([item.id, item.title, item.body]));
  if (language === "en" || !sources.length) return null;
  if (
    previous?.language === language &&
    sources.every((source) => previous.sources.has(source))
  )
    return previous;
  return {
    language,
    sources: new Set(sources),
    deadline: now + CARD_TRANSLATION_WAIT_MS,
  };
}
