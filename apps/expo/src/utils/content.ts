/** Shared shape + helpers for backend content items (bills, orders, cases). */
import type { ContentCardItem } from "~/components/ui";
import { resolveType } from "~/styles";

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: "bill" | "government_content" | "court_case" | "general";
  thumbnailUrl?: string;
  imageUri?: string;
  billNumber?: string;
  jurisdiction?: "federal" | "ca";
  jurisdictionCode?: "US" | "CA";
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

/** Map API content onto a card, preserving state-legislation context. */
export function toCardItem(
  item: ContentItem,
  options: { showJurisdiction?: boolean } = {},
): ContentCardItem {
  const isStateBill = item.type === "bill" && item.jurisdiction === "ca";
  const activity = relativeActivity(item.activityAt);
  return {
    id: item.id,
    type: resolveType(item.type),
    tag: isStateBill
      ? stateBillTag(item.billNumber, !!options.showJurisdiction)
      : item.billNumber,
    title: item.title,
    gist: item.description,
    status: isStateBill
      ? [item.billStatus, activity].filter(Boolean).join(" · ")
      : STATUS_LABEL[item.type],
    meta: isStateBill
      ? [item.chamber && `California ${item.chamber}`, item.sponsor]
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
