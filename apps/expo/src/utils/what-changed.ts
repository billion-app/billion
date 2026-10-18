/**
 * Home answers one question: what moved in the records we already have.
 *
 * The copy is derived from featured/local cards — never from a fabricated
 * "today" feed. A returning reader sees movement only when `activityAt` is
 * newer than their last visit.
 */
import type { AppLanguage } from "~/i18n/language";
import { appTranslator, translateApp } from "~/i18n/app-strings";
import { formatDate } from "~/i18n/format";

export const BRIEF_MIN = 3;
export const BRIEF_MAX = 7;

export type ChangeContentType =
  | "bill"
  | "government_content"
  | "court_case"
  | "general";

export interface ChangeItem {
  id: string;
  type: ChangeContentType;
  title: string;
  billNumber?: string;
  billStatus?: string;
  activityAt?: Date;
  jurisdiction?: string;
  featureTakeaway?: string;
}

export interface ChangeLine {
  id: string;
  /** WHAT happened — bill number + status, or the record title. */
  headline: string;
  /** WHY it matters — only when the API already supplied a takeaway. */
  why?: string;
  /** YOUR CONNECTION — follow/watch, never a guessed topic match. */
  connection?: string;
}

export interface ChangeContext {
  savedIds: ReadonlySet<string>;
  vectors: readonly string[];
  place?: string;
  lastVisitAt?: Date;
  now?: Date;
}

function activityMs(item: ChangeItem): number {
  const at = item.activityAt;
  if (!at) return 0;
  const date = at instanceof Date ? at : new Date(at);
  const ms = date.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function movedSince(item: ChangeItem, lastVisitAt: Date | undefined): boolean {
  if (!lastVisitAt) return false;
  const ms = activityMs(item);
  return ms > 0 && ms > lastVisitAt.getTime();
}

/** Strip the `(2025–2026)` session tail used on some state bill numbers. */
export function displayBillNumber(
  billNumber: string | undefined,
): string | undefined {
  if (!billNumber) return undefined;
  return billNumber.replace(/\s+\([^)]+\)$/, "").trim() || undefined;
}

export function changeHeadline(item: ChangeItem): string {
  if (item.type === "bill") {
    const number = displayBillNumber(item.billNumber);
    if (number && item.billStatus) return `${number} · ${item.billStatus}`;
    if (number) return number;
  }
  return item.title.trim();
}

/** `ctx.place` is the place name already in `language`. */
export function changeConnection(
  item: ChangeItem,
  ctx: Pick<ChangeContext, "savedIds" | "vectors" | "place">,
  language: AppLanguage = "en",
): string | undefined {
  const t = appTranslator(language);
  if (ctx.savedIds.has(item.id)) return t("change.saved");
  if (item.type === "bill" && item.jurisdiction === "federal") {
    if (ctx.vectors.includes("congress")) return t("change.watchCongress");
  }
  if (
    item.type === "bill" &&
    item.jurisdiction &&
    item.jurisdiction !== "federal" &&
    ctx.vectors.includes("state")
  ) {
    return ctx.place
      ? t("change.watchPlace", { place: ctx.place })
      : t("change.watchState");
  }
  if (item.type === "court_case" && ctx.vectors.includes("courts")) {
    return t("change.watchCourts");
  }
  if (item.type === "government_content" && ctx.vectors.includes("executive")) {
    return t("change.watchWhiteHouse");
  }
  return undefined;
}

export function toChangeLine(
  item: ChangeItem,
  ctx: Pick<ChangeContext, "savedIds" | "vectors" | "place">,
  language: AppLanguage = "en",
): ChangeLine {
  const why = item.featureTakeaway?.trim();
  const line: ChangeLine = {
    id: item.id,
    headline: changeHeadline(item),
    connection: changeConnection(item, ctx, language),
  };
  if (why) line.why = why;
  return line;
}

/**
 * Newest government activity first. Followed records rise only when they
 * actually moved; otherwise recency still wins so home cannot hide a vote
 * behind an untouched bookmark.
 */
export function selectChangeItems(
  items: readonly ChangeItem[],
  ctx: Pick<ChangeContext, "savedIds" | "lastVisitAt">,
  limit = BRIEF_MAX,
): ChangeItem[] {
  const seen = new Set<string>();
  const unique: ChangeItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  unique.sort((a, b) => {
    const aMoved = movedSince(a, ctx.lastVisitAt) && ctx.savedIds.has(a.id);
    const bMoved = movedSince(b, ctx.lastVisitAt) && ctx.savedIds.has(b.id);
    if (aMoved !== bMoved) return aMoved ? -1 : 1;
    return activityMs(b) - activityMs(a);
  });

  return unique.slice(0, Math.max(0, Math.min(limit, BRIEF_MAX)));
}

/**
 * Count lines for the brief header. Types first; a follow line only when
 * some — not all — of the items are followed, so it adds signal.
 */
export function movedSummaryLines(
  items: readonly ChangeItem[],
  ctx: Pick<ChangeContext, "savedIds">,
  language: AppLanguage = "en",
): string[] {
  if (items.length === 0) return [];
  const t = appTranslator(language);

  let bills = 0;
  let courts = 0;
  let executive = 0;
  let followed = 0;
  for (const item of items) {
    if (item.type === "bill") bills += 1;
    else if (item.type === "court_case") courts += 1;
    else if (item.type === "government_content") executive += 1;
    if (ctx.savedIds.has(item.id)) followed += 1;
  }

  const lines: string[] = [];
  if (bills > 0) lines.push(t("change.billsMoved", { count: bills }));
  if (courts > 0) lines.push(t("change.courtRulings", { count: courts }));
  if (executive > 0) {
    lines.push(t("change.executiveActions", { count: executive }));
  }
  if (followed > 0 && followed < items.length) {
    lines.push(t("change.savedMoved", { count: followed }));
  }
  return lines;
}

export function briefDateLabel(
  now: Date,
  language: AppLanguage = "en",
): string {
  return formatDate(language, now, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function briefCountLine(
  count: number,
  somethingMoved: boolean,
  language: AppLanguage = "en",
): string {
  if (count <= 0) return translateApp(language, "change.nothingNew");
  return translateApp(
    language,
    somethingMoved ? "change.movedAway" : "change.worthKnowing",
    { count },
  );
}

export function anyMovedSince(
  items: readonly ChangeItem[],
  lastVisitAt: Date | undefined,
): boolean {
  if (!lastVisitAt) return false;
  return items.some((item) => movedSince(item, lastVisitAt));
}
