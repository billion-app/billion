/**
 * The Elections tab states results provenance and poll coverage once per
 * list instead of on every row. This derives that line from the standings
 * shown in the current tab.
 */
export interface ReportStamp {
  reportedAt: string;
  reportingLabel: string;
}

export type StampRow =
  | { kind: "none" }
  | { kind: "poll" }
  | { kind: "official"; result: ReportStamp }
  | undefined;

export type ResultsStatus = "loading" | "unavailable" | "reported";

/** `other` means some rows show a poll and the remaining rows have none. */
export type PollNote = "loading" | "unavailable" | "none" | "other";

export interface GuideListStamp {
  results: ReportStamp | undefined;
  polls: PollNote | undefined;
}

export function guideListStamp(
  rows: readonly StampRow[],
  status: ResultsStatus,
  showPolls: boolean,
): GuideListStamp | undefined {
  let results: ReportStamp | undefined;
  for (const row of rows) {
    if (
      row?.kind === "official" &&
      (!results ||
        Date.parse(row.result.reportedAt) > Date.parse(results.reportedAt))
    )
      results = row.result;
  }
  const missing = rows.some((row) => !row || row.kind === "none");
  const polls: PollNote | undefined = !showPolls
    ? undefined
    : status !== "reported"
      ? status
      : !missing
        ? undefined
        : rows.some((row) => row?.kind === "poll")
          ? "other"
          : "none";
  if (!results && !polls) return undefined;
  return { results, polls };
}
