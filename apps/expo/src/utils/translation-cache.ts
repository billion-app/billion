/** Failures can recover; successful translations live under an English hash. */
export const translationCachePolicy = {
  staleTime: (query: { state: { data?: { status: string } } }) =>
    query.state.data?.status === "translated" ? Infinity : 0,
  refetchInterval: (query: { state: { data?: { status: string } } }) =>
    ["unavailable", "pending"].includes(query.state.data?.status ?? "")
      ? 3_000
      : false,
};
