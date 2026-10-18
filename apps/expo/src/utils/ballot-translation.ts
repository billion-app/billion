export interface BallotIdentity {
  kind: "measure" | "contest";
  title: string;
  candidates: string[];
}
export function matchesBallotIdentity(
  left: BallotIdentity,
  right: BallotIdentity,
) {
  return (
    left.kind === right.kind &&
    left.title === right.title &&
    left.candidates.length === right.candidates.length &&
    left.candidates.every((name, index) => name === right.candidates[index])
  );
}
/** A translation cannot relabel a different route or a revised source field. */
export function ballotDisplayText<T extends string | undefined>(
  original: T,
  key: string,
  overlay:
    | {
        originals: Record<string, string>;
        translations: Record<string, string>;
      }
    | undefined,
): T | string {
  if (!overlay) return original;
  return overlay.originals[key] === original
    ? (overlay.translations[key] ?? original)
    : original;
}

export function ballotIdentityFromRoute(
  value?: string,
): BallotIdentity | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("kind" in parsed) ||
      !("title" in parsed) ||
      !("candidates" in parsed)
    )
      return undefined;
    if (
      (parsed.kind !== "measure" && parsed.kind !== "contest") ||
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.candidates) ||
      !parsed.candidates.every((name: unknown) => typeof name === "string")
    )
      return undefined;
    return {
      kind: parsed.kind,
      title: parsed.title,
      candidates: parsed.candidates as string[],
    };
  } catch {
    return undefined;
  }
}
