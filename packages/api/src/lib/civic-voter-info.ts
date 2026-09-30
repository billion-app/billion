import type { VoterInfoResponse } from "./civic";
import {
  BALLOT_CACHE_VERSION,
  ballotSelectionDate,
} from "../clients/democracy-works";

/** Transport-independent read path so cold/cache/failure behavior can be exercised offline. */
export function createVoterInfoLoader(deps: {
  now?: () => Date;
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
  /** Attach ingested source records on every read, outside the provider cache. */
  supplement?: (result: VoterInfoResponse) => Promise<VoterInfoResponse>;
}) {
  return async (
    address: string,
    electionId?: string,
    options: { includeEnrichment?: boolean } = {},
  ): Promise<VoterInfoResponse> => {
    const endpoint = `${BALLOT_CACHE_VERSION}:${options.includeEnrichment === false ? "base" : "enriched"}`;
    const cacheParams = electionId
      ? { electionId }
      : { startDate: ballotSelectionDate(deps.now?.()) };
    const cached = await deps.getCached(address, endpoint, cacheParams);
    if (cached)
      return deps.supplement
        ? deps.supplement(structuredClone(cached))
        : cached;
    const params: Record<string, string> = { address };
    if (electionId) params.electionId = electionId;
    const result = await deps.fetch(params);
    if (options.includeEnrichment !== false) await deps.enrich(result);
    // Cache only the provider-returned election identity.
    const writeParams = electionId
      ? { electionId: result.election.id }
      : cacheParams;
    await deps.setCache(address, endpoint, writeParams, result);
    return deps.supplement ? deps.supplement(structuredClone(result)) : result;
  };
}
