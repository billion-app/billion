import type { ContentItem } from "./content";
import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";
import { translateCardMetadata } from "./card-metadata";

export interface FeaturedBillItem extends ContentItem {
  featureTakeaway?: string;
  featuredPosition: number;
}

export function withoutFeaturedBills<T extends { id: string }>(
  items: readonly T[],
  featuredBills: readonly { id: string }[],
): T[] {
  if (featuredBills.length === 0) return [...items];
  const featuredIds = new Set(featuredBills.map((item) => item.id));
  return items.filter((item) => !featuredIds.has(item.id));
}

/** The title and takeaway use the API display locale; IDs stay unchanged. */
export function featuredBillAccessibilityLabel(
  item: FeaturedBillItem,
  index: number,
  total: number,
  language: AppLanguage = "en",
): string {
  return [
    translateApp(language, "card.featuredA11y", { index: index + 1, total }),
    item.billNumber,
    item.title,
    item.featureTakeaway ?? item.description,
    translateCardMetadata(item.billStatus, language),
  ]
    .filter(Boolean)
    .map((part) => String(part).replace(/[.\s]+$/, ""))
    .join(". ");
}
