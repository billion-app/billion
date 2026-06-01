/**
 * Per-candidate enrichment cache.
 *
 * Candidate enrichment is on-demand and cache-only, exactly like the voterinfo
 * flow: there is NO durable DB persistence of candidates (we deliberately do not
 * touch CandidateRecord/ContestRecord). The CivicApiCache row IS the only
 * storage — recompute on miss/expiry.
 *
 * This mainly dedupes the same candidate across different addresses/contests and
 * survives eviction of the 24h voterinfo response cache. Bios change rarely, so
 * the TTL here is longer (7 days).
 *
 * The select-with-expiry + insert-onConflictDoUpdate logic is replicated locally
 * from civic.ts because those helpers (getCached/setCache) are not exported.
 */

import { and, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { CanonicalCandidate } from "./candidate-sources/types";

const ENDPOINT = "candidate-enrich";
/** Candidate cache is keyed globally (not per-address) — same as other global caches. */
const ADDRESS_HASH = "__global__";
/** Bios are slow-changing; cache for 7 days (>= the 24h voterinfo TTL). */
const CANDIDATE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/** Normalize an optional disambiguator: lowercased/trimmed, or undefined when absent. */
function normOpt(v: string | undefined): string | undefined {
  const n = v?.toLowerCase().trim();
  return n && n.length > 0 ? n : undefined;
}

/**
 * Build the cache `params` key. Name and office are normalized (lowercased,
 * trimmed) so trivial casing/spacing differences still hit the same cache row.
 *
 * Google Civic office strings are generic (e.g. "Member, State Assembly"), so
 * name+office+year alone under-keys the cache: two different same-name
 * candidates in different states/districts would collide and the first computed
 * would be served for everyone. The optional disambiguators (stateAbbrev,
 * district, county) make the key identify the PERSON. They are omitted from the
 * key when absent so unscoped lookups stay stable.
 *
 * Param order (must match get/setCachedCandidate):
 *   name, office, electionYear, stateAbbrev?, district?, county?
 */
function cacheParams(
  name: string,
  office: string,
  electionYear: number,
  stateAbbrev?: string,
  district?: string,
  county?: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    name: name.toLowerCase().trim(),
    office: office.toLowerCase().trim(),
    electionYear,
  };
  const state = normOpt(stateAbbrev);
  const dist = normOpt(district);
  const cty = normOpt(county);
  if (state) params.stateAbbrev = state;
  if (dist) params.district = dist;
  if (cty) params.county = cty;
  return params;
}

/**
 * Read a cached, merged candidate record. Best-effort: any failure (DB down,
 * schema drift) returns null so the request falls back to recomputing rather
 * than erroring.
 */
export async function getCachedCandidate(
  name: string,
  office: string,
  electionYear: number,
  stateAbbrev?: string,
  district?: string,
  county?: string,
): Promise<CanonicalCandidate | null> {
  try {
    const paramsStr = stableStringify(
      cacheParams(name, office, electionYear, stateAbbrev, district, county),
    );
    const [row] = await db
      .select()
      .from(CivicApiCache)
      .where(
        and(
          eq(CivicApiCache.addressHash, ADDRESS_HASH),
          eq(CivicApiCache.endpoint, ENDPOINT),
          eq(CivicApiCache.params, paramsStr),
          gt(CivicApiCache.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ? (row.responseData as CanonicalCandidate) : null;
  } catch {
    return null;
  }
}

/**
 * Write a merged candidate record to the cache. Best-effort: a write failure
 * never breaks the request (the candidate just won't be cached this time).
 */
export async function setCachedCandidate(
  name: string,
  office: string,
  electionYear: number,
  data: CanonicalCandidate,
  stateAbbrev?: string,
  district?: string,
  county?: string,
): Promise<void> {
  try {
    const paramsStr = stableStringify(
      cacheParams(name, office, electionYear, stateAbbrev, district, county),
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CANDIDATE_CACHE_TTL);
    await db
      .insert(CivicApiCache)
      .values({
        addressHash: ADDRESS_HASH,
        endpoint: ENDPOINT,
        params: paramsStr,
        responseData: data,
        fetchedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          CivicApiCache.addressHash,
          CivicApiCache.endpoint,
          CivicApiCache.params,
        ],
        set: { responseData: data, fetchedAt: now, expiresAt },
      });
  } catch {
    // best-effort cache; swallow
  }
}
