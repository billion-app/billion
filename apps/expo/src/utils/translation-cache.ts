/** Failures can recover; successful translations live under an English hash. */
export const translationCachePolicy = {
  staleTime: (query: { state: { data?: { status: string } } }) =>
    query.state.data?.status === "translated" ? Infinity : 0,
  refetchInterval: (query: { state: { data?: { status: string } } }) =>
    query.state.data?.status === "unavailable" ? 60_000 : false,
};
