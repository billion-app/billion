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
  return kind === "ranked"
    ? `Rank up to ${maximum} choices`
    : `Select up to ${maximum} candidate${maximum === 1 ? "" : "s"}`;
}
