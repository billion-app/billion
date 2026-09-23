import type { BillBriefRecord, CourtBriefRecord } from "@acme/validators";

export type ReaderStructuredBrief =
  | { kind: "bill"; brief: BillBriefRecord }
  | { kind: "court"; brief: CourtBriefRecord };

/** Keep record-specific briefs discriminated so one renderer cannot consume another's schema. */
export function selectReaderBrief(content: {
  type: string;
  brief?: BillBriefRecord | null;
  courtBrief?: CourtBriefRecord | null;
}): ReaderStructuredBrief | null {
  if (content.type === "court_case" && content.courtBrief)
    return { kind: "court", brief: content.courtBrief };
  if (content.type === "bill" && content.brief)
    return { kind: "bill", brief: content.brief };
  return null;
}
