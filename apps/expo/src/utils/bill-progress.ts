/**
 * A compact legislative path for the reader, derived only from the
 * already-projected status label. Home and article detail never invent a
 * chamber the source has not established.
 */

export type BillStageId = "committee" | "house" | "senate" | "executive";

export interface BillStage {
  id: BillStageId;
  label: string;
}

export interface BillProgress {
  stages: readonly BillStage[];
  /** Stages the status label has actually established. */
  reached: readonly BillStageId[];
  current: BillStageId;
}

const FEDERAL_STAGES: readonly BillStage[] = [
  { id: "committee", label: "Committee" },
  { id: "house", label: "House" },
  { id: "senate", label: "Senate" },
  { id: "executive", label: "President" },
];

const STATE_STAGES: readonly BillStage[] = [
  { id: "committee", label: "Committee" },
  { id: "house", label: "House" },
  { id: "senate", label: "Senate" },
  { id: "executive", label: "Governor" },
];

export function stagesFor(
  jurisdiction: string | undefined | null,
): readonly BillStage[] {
  return jurisdiction && jurisdiction !== "federal"
    ? STATE_STAGES
    : FEDERAL_STAGES;
}

function unique(ids: BillStageId[]): BillStageId[] {
  return [...new Set(ids)];
}

/**
 * Map a reader-facing status onto the four-stop path.
 *
 * Unknown or generic labels ("Proposed", a raw action string) leave every
 * stop empty and park the marker on Committee. Chamber passage is filled
 * only when the label names that chamber, or both, or a later terminal.
 */
export function billProgressFromStatus(
  status: string | undefined | null,
  jurisdiction?: string | null,
): BillProgress {
  const stages = stagesFor(jurisdiction);
  const text = (status ?? "").trim().toLowerCase();

  if (!text) {
    return { stages, reached: [], current: "committee" };
  }

  const enacted =
    /\benacted\b/.test(text) ||
    /\bsigned\b/.test(text) ||
    /\bchaptered\b/.test(text) ||
    /\bbecame law\b/.test(text);
  const vetoed = /\bvetoed\b/.test(text);
  const presented = /\bpresented to (?:the )?(?:president|governor)\b/.test(
    text,
  );
  const both =
    /\bboth chambers\b/.test(text) || /\bagreed to by both\b/.test(text);
  const house =
    /\bpassed house\b/.test(text) || /\bagreed to in house\b/.test(text);
  const senate =
    /\bpassed senate\b/.test(text) || /\bagreed to in senate\b/.test(text);
  const committee = /\bpassed committee\b/.test(text);

  if (enacted || vetoed) {
    return {
      stages,
      reached: unique(["committee", "house", "senate", "executive"]),
      current: "executive",
    };
  }
  if (presented || both) {
    return {
      stages,
      reached: unique(["committee", "house", "senate"]),
      current: "executive",
    };
  }
  if (house && senate) {
    return {
      stages,
      reached: unique(["committee", "house", "senate"]),
      current: "executive",
    };
  }
  if (house) {
    return {
      stages,
      reached: unique(["committee", "house"]),
      current: "senate",
    };
  }
  if (senate) {
    return {
      stages,
      reached: unique(["committee", "senate"]),
      current: "house",
    };
  }
  if (committee) {
    return {
      stages,
      reached: ["committee"],
      current: "house",
    };
  }

  return { stages, reached: [], current: "committee" };
}

export function stageIsReached(
  progress: BillProgress,
  id: BillStageId,
): boolean {
  return progress.reached.includes(id);
}
