/** Shared shape + helpers for backend content items (bills, orders, cases). */
import type { ContentCardItem } from "~/components/ui";
import type { AppLanguage } from "~/i18n/language";
import type {
  ContentJurisdiction,
  JurisdictionCode,
} from "~/utils/jurisdiction";
import { translateApp } from "~/i18n/app-strings";
import { resolveType } from "~/styles";
import { isStateJurisdiction, jurisdictionText } from "~/utils/jurisdiction";

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

function statusLabel(type: ContentItem["type"], language: AppLanguage) {
  return translateApp(language, `card.status.${type}`);
}

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

/**
 * Map API content onto a card, preserving legislative status and context.
 * Bill status and chamber are source text and stay as published; the type
 * label and place name follow `language`.
 */
export function toCardItem(
  item: ContentItem,
  options: { showJurisdiction?: boolean; language?: AppLanguage } = {},
): ContentCardItem {
  const language = options.language ?? "en";
  const stateName = isStateJurisdiction(item.jurisdiction)
    ? jurisdictionText(item.jurisdiction, language).name
    : undefined;
  const isBill = item.type === "bill";
  const isStateBill = isBill && !!stateName;
  return {
    id: item.id,
    type: resolveType(item.type),
    tag: isStateBill
      ? stateBillTag(item.billNumber, !!options.showJurisdiction)
      : item.billNumber,
    title: item.title,
    gist: item.description,
    status: isBill
      ? (item.billStatus ?? statusLabel("bill", language))
      : statusLabel(item.type, language),
    activityAt: isBill ? item.activityAt : undefined,
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
