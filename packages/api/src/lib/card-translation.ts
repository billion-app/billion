import { createHash } from "node:crypto";

import type { TranslationLanguage } from "./content-translation";
import { collectSegments } from "./content-translation";
import { getSegmentTranslationsMany } from "./content-translation-store";

export interface TranslatableCard {
  id: string;
  type: "bill" | "government_content" | "court_case" | "general";
  title: string;
  description: string;
  featureTakeaway?: string | null;
}

export function cardTranslationRequest(
  card: TranslatableCard,
  language: TranslationLanguage,
) {
  // Card requests must never replace a full reader's cache or active lease.
  // Editorial takeaways have their own scope so ordinary Browse cannot erase them.
  const scope = card.featureTakeaway ? "featured-card" : "card";
  const hex = createHash("sha256")
    .update(`billion:${scope}:${card.type}:${card.id}`)
    .digest("hex");
  return {
    contentId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
    contentType:
      card.type === "general" ? ("government_content" as const) : card.type,
    language,
    segments: collectSegments(
      card,
      ["title", "description", "featureTakeaway"],
      "card",
    ),
  };
}

export function applyCardTranslation<T extends TranslatableCard>(
  card: T,
  payload: Record<string, string> | null,
) {
  const complete =
    payload &&
    collectSegments(
      card,
      ["title", "description", "featureTakeaway"],
      "card",
    ).every(({ key }) => !!payload[key]?.trim());
  return {
    ...card,
    title: complete ? (payload["card.title"] ?? card.title) : card.title,
    description: complete
      ? (payload["card.description"] ?? card.description)
      : card.description,
    ...(card.featureTakeaway
      ? {
          featureTakeaway: complete
            ? payload["card.featureTakeaway"]
            : card.featureTakeaway,
        }
      : {}),
    translationState: complete ? ("translated" as const) : ("pending" as const),
  };
}

export async function localizeContentCards<T extends TranslatableCard>(
  cards: T[],
  language: "en" | TranslationLanguage = "en",
): Promise<
  (T & {
    translationState: "original" | "pending" | "translated" | "unavailable";
  })[]
> {
  if (language === "en")
    return cards.map((card) => ({
      ...card,
      translationState: "original" as const,
    }));
  try {
    const payloads = await getSegmentTranslationsMany(
      cards.map((card) => cardTranslationRequest(card, language)),
    );
    return cards.map((card, index) =>
      applyCardTranslation(card, payloads[index] ?? null),
    );
  } catch (error) {
    console.error("Unable to translate content cards", error);
    return cards.map((card) => ({
      ...card,
      translationState: "unavailable" as const,
    }));
  }
}
