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
}

const STATUS_LABEL: Record<ContentItem["type"], string> = {
  bill: "Legislation",
  government_content: "Executive action",
  court_case: "Court case",
  general: "Briefing",
};

/** Map a backend content item onto the props a ContentCard expects. */
export function toCardItem(item: ContentItem): ContentCardItem {
  return {
    id: item.id,
    type: resolveType(item.type),
    title: item.title,
    gist: item.description,
    status: STATUS_LABEL[item.type],
    thumbnailUrl: item.thumbnailUrl,
    imageUri: item.imageUri,
  };
}
