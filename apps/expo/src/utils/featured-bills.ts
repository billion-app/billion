import type { ContentItem } from "./content";

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

export function featuredBillAccessibilityLabel(
  item: FeaturedBillItem,
  index: number,
  total: number,
): string {
  return [
    `Featured bill ${index + 1} of ${total}`,
    item.billNumber,
    item.title,
    item.featureTakeaway ?? item.description,
    item.billStatus,
  ]
    .filter(Boolean)
    .map((part) => String(part).replace(/[.\s]+$/, ""))
    .join(". ");
}
