/**
 * Shared shape for the CA Secretary of State voter-guide statement handoff cache.
 *
 * The CA SOS Official Voter Information Guide publishes verbatim candidate
 * statements for the nine statewide offices on stable, election-agnostic URLs
 * (`/candidates/{office}-candidate-statements.htm` — no electionId in the path).
 * The scraper (apps/scraper) fetches and parses those pages on a cron and writes
 * ONE CivicApiCache row per election year; the SOS adapter (./ca-sos-voterguide.ts)
 * reads that row at request time and matches a candidate by name — keeping the
 * page fetch + HTML parse out of the serverless API path.
 *
 * Both sides import these constants and `caSosCacheParams` so the written
 * `params` string byte-matches the read `params` — a mismatch is a silent,
 * error-free cache miss. Mirrors ./scc-cvig-cache.ts.
 */

import { stableStringify } from "./types";

/** CivicApiCache.addressHash for the SOS statement handoff (global, not per-address). */
export const CA_SOS_ADDRESS_HASH = "__global__";

/** CivicApiCache.endpoint namespace for the SOS statement handoff. */
export const CA_SOS_ENDPOINT = "ca-sos-statements";

/** One parsed candidate statement from a CA SOS office page. */
export interface CaSosStatement {
  /** Candidate name as printed in the guide heading. */
  name: string;
  /** SOS office slug the statement appeared under (e.g. "governor"). */
  officeSlug: string;
  /** Verbatim statement prose. */
  statement: string;
  /** The office page this was parsed from (for attribution). */
  sourceUrl: string;
  photoUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  channels?: { type: string; id: string }[];
}

/** Payload stored in CivicApiCache.responseData for one election's guide. */
export interface CaSosPayload {
  statements: CaSosStatement[];
}

/**
 * Build the CivicApiCache.params string for an election year. One row holds all
 * statewide candidates for that election. Single source of truth for the key so
 * the scraper write and the adapter read never drift.
 */
export function caSosCacheParams(electionYear: number): string {
  return stableStringify({ electionYear });
}
