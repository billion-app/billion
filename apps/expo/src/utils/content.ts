/** Shared shape + helpers for backend content items (bills, orders, cases). */
import type { ContentCardItem } from "~/components/ui";
import type {
  ContentJurisdiction,
  JurisdictionCode,
} from "~/utils/jurisdiction";
import { resolveType } from "~/styles";
import { isStateJurisdiction, JURISDICTIONS } from "~/utils/jurisdiction";

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: "bill" | "government_content" | "court_case" | "general";
  thumbnailUrl?: string;
  imageUri?: string;
  billNumber?: string;
  jurisdiction?: ContentJurisdiction;
  jurisdictionCode?: JurisdictionCode;
  billStatus?: string;
  activityAt?: Date;
  chamber?: string;
  sponsor?: string;
  sessionLabel?: string;
}

const STATUS_LABEL: Record<ContentItem["type"], string> = {
  bill: "Legislation",
  government_content: "Executive action",
  court_case: "Court case",
  general: "Briefing",
};

/** Map a backend content item onto the props a ContentCard expects. */
function stateBillTag(
  billNumber: string | undefined,
  showJurisdiction: boolean,
): string | undefined {
  if (!billNumber) return undefined;
  const match = /^([A-Z]{2})\s+(.+?)\s+\([^)]+\)$/.exec(billNumber);
  if (!match) return billNumber;
  return showJurisdiction ? match[2] : `${match[1]} ${match[2]}`;
}

function relativeActivity(value: Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  const elapsedDays = Math.floor(
    Math.max(0, Date.now() - date.getTime()) / 86_400_000,
  );
  if (elapsedDays === 0) return "today";
  if (elapsedDays === 1) return "1 day ago";
  if (elapsedDays < 30) return `${elapsedDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Map API content onto a card, preserving legislative status and context. */
export function toCardItem(
  item: ContentItem,
  options: { showJurisdiction?: boolean } = {},
): ContentCardItem {
  const stateName = isStateJurisdiction(item.jurisdiction)
    ? JURISDICTIONS[item.jurisdiction].name
    : undefined;
  const isBill = item.type === "bill";
  const isStateBill = isBill && !!stateName;
  const activity = relativeActivity(item.activityAt);
  const legislativeStatus = [item.billStatus, activity]
    .filter(Boolean)
    .join(" · ");
  return {
    id: item.id,
    type: resolveType(item.type),
    tag: isStateBill
      ? stateBillTag(item.billNumber, !!options.showJurisdiction)
      : item.billNumber,
    title: item.title,
    gist: item.description,
    status: isBill
      ? legislativeStatus || STATUS_LABEL.bill
      : STATUS_LABEL[item.type],
    meta: isStateBill
      ? [item.chamber && `${stateName} ${item.chamber}`, item.sponsor]
          .filter(Boolean)
          .join(" · ")
      : undefined,
    jurisdictionCode:
      isStateBill && options.showJurisdiction
        ? item.jurisdictionCode
        : undefined,
    statusTone: /veto/i.test(item.billStatus ?? "") ? "warning" : "accent",
    thumbnailUrl: item.thumbnailUrl,
    imageUri: item.imageUri,
  };
}
