import type { VoterInfoResponse } from "./civic";

/** Transport-independent read path so cold/cache/failure behavior can be exercised offline. */
export function createVoterInfoLoader(deps: {
  getCached: (
    address: string,
    endpoint: string,
    params: Record<string, unknown>,
  ) => Promise<VoterInfoResponse | null>;
  setCache: (
    address: string,
    endpoint: string,
    params: Record<string, unknown>,
    result: VoterInfoResponse,
  ) => Promise<void>;
  fetch: (params: Record<string, string>) => Promise<VoterInfoResponse>;
  enrich: (result: VoterInfoResponse) => Promise<void>;
}) {
  return async (
    address: string,
    electionId?: string,
    options: { includeEnrichment?: boolean } = {},
  ): Promise<VoterInfoResponse> => {
    const endpoint =
      options.includeEnrichment === false ? "voterinfoBase" : "voterinfo";
    const cacheParams = electionId ? { electionId } : {};
    const cached = await deps.getCached(address, endpoint, cacheParams);
    if (cached) return cached;
    const params: Record<string, string> = { address };
    if (electionId) params.electionId = electionId;
    let result: VoterInfoResponse;
    try {
      result = await deps.fetch(params);
    } catch (error) {
      if (!electionId || !/election unknown/i.test(String(error))) throw error;
      delete params.electionId;
      result = await deps.fetch(params);
    }
    if (options.includeEnrichment !== false) await deps.enrich(result);
    await deps.setCache(address, endpoint, cacheParams, result);
    return result;
  };
}
