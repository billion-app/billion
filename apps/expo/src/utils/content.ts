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
import { translateCardMetadata } from "./card-metadata";

export interface ContentItem {
  translationState?: "original" | "pending" | "translated" | "unavailable";
  id: string;
  title: string;
  description: string;
  type: "bill" | "government_content" | "court_case" | "general";
  governmentContentType?: string;
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
 * Known lifecycle and chamber labels follow the locale; identifiers and names
 * retain their original values.
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
    governmentContentType: item.governmentContentType,
    tag: isStateBill
      ? stateBillTag(item.billNumber, !!options.showJurisdiction)
      : item.billNumber,
    title: item.title,
    gist: item.description,
    status: isBill
      ? (translateCardMetadata(item.billStatus, language) ??
        statusLabel("bill", language))
      : statusLabel(item.type, language),
    activityAt: isBill ? item.activityAt : undefined,
    meta: isStateBill
      ? [
          item.chamber &&
            `${stateName} ${translateCardMetadata(item.chamber, language)}`,
          item.sponsor,
        ]
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
