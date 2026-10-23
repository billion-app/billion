export const PUBLIC_CONTENT_STALE_TIME = 60_000;

export interface CardTranslationState {
  translationState?: "original" | "pending" | "translated" | "unavailable";
}

export type CardTranslationData =
  | CardTranslationState[]
  | { items: CardTranslationState[] }
  | { pages: { items: CardTranslationState[] }[] };

export function cardTranslationItems(
  data: CardTranslationData | undefined,
): CardTranslationState[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return "pages" in data
    ? data.pages.flatMap((page) => page.items)
    : data.items;
}

export function cardTranslationPolling(query: {
  state: { data?: CardTranslationData };
}): number | false {
  return cardTranslationItems(query.state.data).some(
    (item) => item.translationState === "pending",
  )
    ? 3_000
    : false;
}

export function cardTranslationState(
  items: readonly CardTranslationState[],
  language: string,
  isError = false,
) {
  if (language === "en" || !items.length) return "original" as const;
  if (
    (isError && items.some((item) => item.translationState !== "translated")) ||
    items.some((item) => item.translationState === "unavailable")
  )
    return "unavailable" as const;
  return items.every((item) => item.translationState === "translated")
    ? ("translated" as const)
    : ("pending" as const);
}
