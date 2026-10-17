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
