/**
 * Shared shape for the Santa Clara County voter-guide statement handoff cache.
 *
 * The scraper (apps/scraper) extracts candidate statements from the county's
 * voter information guide PDFs and writes ONE CivicApiCache row per election;
 * the registrar adapter (./scc-registrar.ts) reads it. Both sides import these
 * constants and `sccCvigCacheParams` so the written `params` string byte-matches
 * the read `params` — a mismatch is a silent, error-free cache miss.
 */

import { stableStringify } from "./types";

/** CivicApiCache.addressHash for the SCC statement handoff (global, not per-address). */
export const SCC_CVIG_ADDRESS_HASH = "__global__";

/** CivicApiCache.endpoint namespace for the SCC statement handoff. */
export const SCC_CVIG_ENDPOINT = "scc-cvig-statements";

/** One extracted candidate statement from the SCC voter information guide. */
export interface SccCvigStatement {
  /** Candidate name as printed in the guide. */
  name: string;
  /** Office/contest heading the statement appeared under, when captured. */
  office?: string;
  /** Verbatim statement prose. */
  statement: string;
  /** The guide PDF this statement was extracted from (for attribution). */
  sourceUrl: string;
}

/** Payload stored in CivicApiCache.responseData for one election's guide. */
export interface SccCvigPayload {
  statements: SccCvigStatement[];
}

/**
 * Build the CivicApiCache.params string for an election year. One row holds all
 * candidates for that election. Keep this the single source of truth for the key
 * so the scraper write and the adapter read never drift.
 */
export function sccCvigCacheParams(electionYear: number): string {
  return stableStringify({ electionYear });
}
