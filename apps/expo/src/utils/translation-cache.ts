/** Failures can recover; successful translations live under an English hash. */
export const translationCachePolicy = {
  staleTime: (query: { state: { data?: { status: string } } }) =>
    query.state.data?.status === "translated" ? Infinity : 0,
  refetchInterval: (query: { state: { data?: { status: string } } }) =>
    ["unavailable", "pending"].includes(query.state.data?.status ?? "")
      ? 3_000
      : false,
};

/** Article API uses `unavailable` for a queued cache miss. */
export function articleTranslationState(
  requested: boolean,
  translated: boolean,
  query: { isError: boolean; isFetching: boolean; data?: { status: string } },
): "original" | "translated" | "pending" | "unavailable" {
  if (!requested) return "original";
  if (translated) return "translated";
  return query.isError ? "unavailable" : "pending";
}

/** A cached response must belong to this language and this exact reader revision. */
export function readyReaderTranslation<
  T extends { status: string; language: string; sourceHash: string },
>(
  language: string,
  sourceHash: string | undefined,
  prepared: T | null | undefined,
  fetched: T | null | undefined,
): (T & { status: "translated" }) | null {
  if (language === "en") return null;
  for (const candidate of [prepared, fetched]) {
    if (
      candidate?.status === "translated" &&
      candidate.language === language &&
      candidate.sourceHash === sourceHash
    )
      return candidate as T & { status: "translated" };
  }
  return null;
}
