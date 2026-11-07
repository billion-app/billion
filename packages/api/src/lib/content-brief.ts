import type { BillBriefRecord } from "@acme/validators";
import { parseBillBriefRecord } from "@acme/validators";

export interface StoredContentBrief {
  brief: unknown;
  contentHash: string;
}

export function parseCurrentContentBrief(
  row: StoredContentBrief,
  sourceContentHash: string,
): BillBriefRecord | null {
  if (row.contentHash !== sourceContentHash) return null;
  return parseBillBriefRecord(row.brief);
}
