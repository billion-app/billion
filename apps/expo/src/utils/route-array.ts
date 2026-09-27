/** Ignore malformed route entries so a bad deep link cannot crash a detail screen. */
export function parseRouteArray<T>(
  raw: string | undefined,
  required: string[],
  optional: string[] = [],
): T[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        return false;
      const record = entry as Record<string, unknown>;
      return (
        required.every((key) => typeof record[key] === "string") &&
        optional.every(
          (key) => record[key] == null || typeof record[key] === "string",
        )
      );
    }) as T[];
  } catch {
    return [];
  }
}
