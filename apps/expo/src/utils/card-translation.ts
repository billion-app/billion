import type { RefetchOptions } from "@tanstack/react-query";

import type { RouterInputs, RouterOutputs } from "./api";

export type CardTranslationLookup =
  RouterInputs["content"]["translationStatus"]["lookups"][number];
type ReadyCardTranslation =
  RouterOutputs["content"]["translationStatus"][number];

export const PUBLIC_CONTENT_STALE_TIME = 60_000;
export const CARD_TRANSLATION_WAIT_MS = 120_000;

export interface CardTranslationState {
  translationLookup?: CardTranslationLookup;
  translationState?: "original" | "pending" | "translated" | "unavailable";
}

export type CardTranslationData =
  | CardTranslationState[]
  | { items: CardTranslationState[] }
  | { sponsoredBills: CardTranslationState[] }
  | { pages: { items: CardTranslationState[] }[] };

export function cardTranslationItems(
  data: CardTranslationData | undefined,
): CardTranslationState[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return "pages" in data
    ? data.pages.flatMap((page) => page.items)
    : "sponsoredBills" in data
      ? data.sponsoredBills
      : data.items;
}

export function pendingCardTranslations(data: CardTranslationData | undefined) {
  const lookups = new Map<string, CardTranslationLookup>();
  for (const item of cardTranslationItems(data)) {
    if (item.translationState !== "pending" || !item.translationLookup)
      continue;
    const lookup = item.translationLookup;
    lookups.set(cardTranslationKey(lookup), lookup);
  }
  return [...lookups.values()].sort((a, b) =>
    cardTranslationKey(a).localeCompare(cardTranslationKey(b)),
  );
}

export function cardTranslationKey(lookup: ReadyCardTranslation) {
  return `${lookup.contentId}:${lookup.sourceHash}`;
}

export function cardTranslationDelay(attempt: number) {
  return Math.min(15_000, 3_000 * 2 ** Math.min(attempt, 3));
}

export interface CardTranslationWait {
  language: string;
  sources: Set<string>;
  deadline: number;
}

export function cardTranslationWait(
  previous: CardTranslationWait | null,
  language: string,
  lookups: CardTranslationLookup[],
  now: number,
): CardTranslationWait {
  if (
    previous?.language === language &&
    lookups.every((lookup) => previous.sources.has(cardTranslationKey(lookup)))
  )
    return previous;
  return {
    language,
    sources: new Set(lookups.map(cardTranslationKey)),
    deadline: now + CARD_TRANSLATION_WAIT_MS,
  };
}

export async function pollCardTranslations(input: {
  lookups: CardTranslationLookup[];
  deadline: number;
  signal: AbortSignal;
  ready: (lookups: CardTranslationLookup[]) => Promise<ReadyCardTranslation[]>;
  refresh: (options: RefetchOptions) => Promise<{
    data: CardTranslationData | null | undefined;
  }>;
  wait: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<"ready" | "expired" | "cancelled"> {
  const now = input.now ?? Date.now;
  const cancelled = () => input.signal.aborted;
  const requested = new Set(input.lookups.map(cardTranslationKey));
  const refreshed = new Set<string>();
  let attempt = 0;
  while (!cancelled() && now() < input.deadline) {
    const ready: ReadyCardTranslation[] = [];
    for (let offset = 0; offset < input.lookups.length; offset += 100) {
      try {
        ready.push(
          ...(await input.ready(input.lookups.slice(offset, offset + 100))),
        );
      } catch {
        if (cancelled()) return "cancelled";
      }
      if (cancelled() || now() >= input.deadline) break;
    }
    if (cancelled()) return "cancelled";
    if (now() >= input.deadline) return "expired";
    const newReady = ready
      .map(cardTranslationKey)
      .filter((key) => requested.has(key) && !refreshed.has(key));
    if (newReady.length) {
      try {
        const result = await input.refresh({ throwOnError: true });
        if (result.data) {
          const pending = new Set(
            pendingCardTranslations(result.data).map(cardTranslationKey),
          );
          newReady
            .filter((key) => !pending.has(key))
            .forEach((key) => refreshed.add(key));
        }
      } catch {
        if (cancelled()) return "cancelled";
      }
    }
    if (cancelled()) return "cancelled";
    if (now() >= input.deadline) return "expired";
    if (refreshed.size === requested.size) return "ready";
    await input.wait(
      Math.min(cardTranslationDelay(attempt++), input.deadline - now()),
    );
  }
  return cancelled() ? "cancelled" : "expired";
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
