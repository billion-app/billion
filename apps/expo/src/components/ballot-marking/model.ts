/** Reviewed official instructions only; provider seat counts are not marking rules. */
export interface ContestInstructions {
  scope: { contestId: string; electionDate: string; jurisdiction: string };
  source: { authority: string; url: string; reviewedAt: string };
  system: string;
  mechanics:
    | { kind: "single"; maximum: number }
    | { kind: "multiple"; maximum: number }
    | { kind: "ranked"; maximum: number };
  marking: string;
  example: string;
  /** Optional source-reviewed oval diagram; example text is its accessible equivalent. */
  exampleDiagram?: {
    target: string;
    columns: string[];
    rows: { label: string; filledColumns: number[] }[];
  };
  writeIns?: string;
  overvotes?: string;
  blankContest?: string;
  electionStage?: string;
}

export function applicableInstructions(
  instructions: ContestInstructions | undefined,
  scope: ContestInstructions["scope"],
): ContestInstructions | undefined {
  if (
    !instructions ||
    !scope.contestId ||
    !scope.electionDate ||
    !scope.jurisdiction
  )
    return;
  if (
    Object.keys(scope).some(
      (key) =>
        instructions.scope[key as keyof typeof scope] !==
        scope[key as keyof typeof scope],
    )
  )
    return;
  const { maximum, kind } = instructions.mechanics;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    (kind === "single" && maximum !== 1)
  )
    return;
  if (
    ![
      instructions.source.authority,
      instructions.system,
      instructions.marking,
      instructions.example,
    ].every((s) => s.trim())
  )
    return;
  if (!Number.isFinite(Date.parse(instructions.source.reviewedAt))) return;
  try {
    if (new URL(instructions.source.url).protocol !== "https:") return;
  } catch {
    return;
  }
  return instructions;
}

export function selectionLabel(instructions: ContestInstructions): string {
  const { kind, maximum } = instructions.mechanics;
  if (kind === "single") return "Choose no more than 1";
  return kind === "ranked"
    ? `Rank up to ${maximum} candidates`
    : `Choose up to ${maximum} candidate${maximum === 1 ? "" : "s"}`;
}

/** Missing or invalid illustrations retain the reviewed textual example. */
export function instructionDiagram(
  instructions: ContestInstructions,
): ContestInstructions["exampleDiagram"] {
  const diagram = instructions.exampleDiagram;
  if (
    diagram?.target !== "oval" ||
    diagram.columns.length < 1 ||
    diagram.columns.length > 3 ||
    diagram.rows.length < 1 ||
    diagram.rows.length > 4
  )
    return;
  if (
    new Set(diagram.columns).size !== diagram.columns.length ||
    diagram.columns.some((column) => !column.trim())
  )
    return;
  if (
    new Set(diagram.rows.map((row) => row.label)).size !== diagram.rows.length
  )
    return;
  if (
    diagram.rows.some(
      (row) =>
        !row.label.trim() ||
        new Set(row.filledColumns).size !== row.filledColumns.length ||
        row.filledColumns.some(
          (index) =>
            !Number.isInteger(index) ||
            index < 0 ||
            index >= diagram.columns.length,
        ),
    )
  )
    return;
  return diagram;
}
