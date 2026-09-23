import { contentType } from "@acme/ui/digest-tokens";

import { isStateScope, STATE_BODIES } from "./jurisdictions";

/**
 * How a record from `content.getByType` / `content.search` becomes a result
 * card. Ported from the phone (`apps/expo/src/utils/content.ts`) so a bill
 * reads the same in both places: same kicker, same tag, same status line.
 */

export type ContentKind =
  | "bill"
  | "government_content"
  | "court_case"
  | "general";

export interface ContentListItem {
  id: string;
  title: string;
  description: string;
  type: ContentKind;
  thumbnailUrl?: string;
  imageUri?: string;
  billNumber?: string;
  jurisdiction?: string;
  jurisdictionCode?: string;
  billStatus?: string;
  activityAt?: Date;
}

export interface TypePresentation {
  /** Badge / kicker text. */
  label: string;
  /** What kind of record this is, for a reader who arrived cold. */
  kind: string;
  color: string;
}

const TYPES: Record<string, TypePresentation | undefined> = {
  bill: { ...contentType.bill, kind: "Legislation" },
  government_content: { ...contentType.exec, kind: "Executive action" },
  court_case: { ...contentType.court, kind: "Court case" },
};

const GENERAL: TypePresentation = { ...contentType.news, kind: "Briefing" };

export function presentType(type: string): TypePresentation {
  return TYPES[type] ?? GENERAL;
}

export interface CardItem {
  id: string;
  type: ContentKind;
  typeLabel: string;
  color: string;
  tag?: string;
  title: string;
  gist?: string;
  status?: string;
  activityAt?: Date;
  jurisdictionCode?: string;
  imageUri?: string;
}

/** `CA AB 12 (2025-2026)` → `CA AB 12`, or `AB 12` when the chip says CA. */
function stateBillTag(
  billNumber: string | undefined,
  showJurisdiction: boolean,
) {
  if (!billNumber) return undefined;
  const match = /^([A-Z]{2})\s+(.+?)\s+\([^)]+\)$/.exec(billNumber);
  if (!match) return billNumber;
  return showJurisdiction ? match[2] : `${match[1]} ${match[2]}`;
}

export function toCardItem(
  item: ContentListItem,
  options: { showJurisdiction?: boolean } = {},
): CardItem {
  const type = presentType(item.type);
  const isBill = item.type === "bill";
  const isStateBill = isBill && isStateScope(item.jurisdiction);
  return {
    id: item.id,
    type: item.type,
    typeLabel: type.label,
    color: type.color,
    tag: isStateBill
      ? stateBillTag(item.billNumber, !!options.showJurisdiction)
      : item.billNumber,
    title: item.title,
    gist: item.description || undefined,
    status: isBill ? (item.billStatus ?? type.kind) : type.kind,
    activityAt: isBill ? item.activityAt : undefined,
    jurisdictionCode:
      isStateBill && options.showJurisdiction
        ? item.jurisdictionCode
        : undefined,
    imageUri: item.imageUri ?? item.thumbnailUrl,
  };
}

/** Display a bill number without the state session suffix. */
export function displayBillNumber(
  billNumber: string | undefined,
  jurisdiction: string | undefined,
) {
  if (!billNumber) return undefined;
  return isStateScope(jurisdiction)
    ? billNumber.replace(/\s+\([^)]+\)$/, "")
    : billNumber;
}

export function stateBody(jurisdiction: string | undefined) {
  return isStateScope(jurisdiction) && jurisdiction
    ? STATE_BODIES[jurisdiction]
    : undefined;
}

/** The age of a legislative action, in the feed's day-level copy. */
export function relativeActivity(
  value: Date | string | undefined,
  now = Date.now(),
): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const elapsedDays = Math.floor(
    Math.max(0, now - date.getTime()) / 86_400_000,
  );
  if (elapsedDays === 0) return "today";
  if (elapsedDays === 1) return "1 day ago";
  if (elapsedDays < 30) return `${elapsedDays} days ago`;
  // UTC so the server's render and the browser's hydration print the same day.
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function withoutFeatured<T extends { id: string }>(
  items: readonly T[],
  featured: readonly { id: string }[],
): T[] {
  if (featured.length === 0) return [...items];
  const featuredIds = new Set(featured.map((item) => item.id));
  return items.filter((item) => !featuredIds.has(item.id));
}

/** Header art is usually an inline data: URI; anything else must be http(s). */
export function safeImageSrc(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  return /^(https?:|data:image\/)/i.test(uri) ? uri : undefined;
}

const SAVEABLE_TYPES = new Set(["bill", "government_content", "court_case"]);

/**
 * Whether a record can be saved. Matches the phone (`useSavedContent`), and
 * matters for more than parity: the saved list loads through
 * `content.byIds`, which only returns these three kinds, so a saved briefing
 * would vanish from the list without a word.
 */
export function isSaveable(type: string): boolean {
  return SAVEABLE_TYPES.has(type);
}
