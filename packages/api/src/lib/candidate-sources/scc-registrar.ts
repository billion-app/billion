/**
 * Santa Clara County Registrar of Voters — local candidate statement adapter.
 *
 * Source: the county's official Voter Information Guide. Down-ballot candidates
 * (city council, school board, judges, water/special districts) submit a §13307
 * statement of qualifications that no statewide/aggregator source carries. The
 * heavy extraction (PDF fetch + parse) runs in apps/scraper, which writes one
 * CivicApiCache row per election; this adapter just reads that row and matches a
 * candidate by name. It therefore needs no network of its own.
 *
 * Scope: California, Santa Clara County only. Gates hard on stateAbbrev === "CA"
 * and (when Civic supplies it) a Santa Clara county string. Best-effort: never
 * throws, returns `null` (not a partial object) when there's no cache row or no
 * confident name match.
 *
 * Trust: tier `county_registrar`, `official: true` — the highest tier, so a
 * registrar statement outranks the CA SOS statewide guide and every aggregator.
 * Registrars publish text-only statements (no headshots), so v1 contributes only
 * `statement`.
 */

import { and, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { CandidateSourceData } from "./types";
import {
  SCC_CVIG_ADDRESS_HASH,
  SCC_CVIG_ENDPOINT,
  sccCvigCacheParams,
} from "./scc-cvig-cache";
import type { SccCvigPayload, SccCvigStatement } from "./scc-cvig-cache";
import { candidateNameSimilarity, clamp, dropInitials } from "./types";

const SOURCE_NAME =
  "Santa Clara County Registrar of Voters — Official Voter Information Guide";
/** Token-overlap threshold to accept a name match (handles nicknames/initials). */
const NAME_MATCH_THRESHOLD = 0.7;
/** Statements run long; clamp to keep the cached record bounded. */
const MAX_STATEMENT_CHARS = 2500;

/**
 * Enrich a candidate from the SCC registrar voter-guide handoff cache.
 *
 * @param name Candidate name from Google Civic.
 * @param ctx  Contest + enrichment context.
 * @returns Source data with the verbatim statement at `county_registrar` tier
 *          when a guide statement matches the candidate, otherwise null.
 */
export async function enrichCandidateFromScc(
  name: string,
  ctx: {
    office?: string;
    stateAbbrev?: string;
    county?: string;
    electionYear: number;
  },
): Promise<CandidateSourceData | null> {
  if (!name.trim()) return null;
  if (ctx.stateAbbrev && ctx.stateAbbrev.toUpperCase() !== "CA") return null;
  // Gate on county when Civic supplies it. Civic sometimes omits county; allow
  // through in that case (the election-scoped cache + name match disambiguate).
  if (ctx.county && !/santa\s*clara/i.test(ctx.county)) return null;

  try {
    const [row] = await db
      .select()
      .from(CivicApiCache)
      .where(
        and(
          eq(CivicApiCache.addressHash, SCC_CVIG_ADDRESS_HASH),
          eq(CivicApiCache.endpoint, SCC_CVIG_ENDPOINT),
          eq(CivicApiCache.params, sccCvigCacheParams(ctx.electionYear)),
          gt(CivicApiCache.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!row) return null;

    // responseData is untyped JSONB written by the scraper; validate defensively.
    const payload: Partial<SccCvigPayload> = row.responseData as SccCvigPayload;
    const statements = Array.isArray(payload.statements)
      ? payload.statements
      : [];
    if (statements.length === 0) return null;

    const query = dropInitials(name);
    let best: { statement: SccCvigStatement; score: number } | null = null;
    for (const s of statements) {
      if (!s.statement.trim()) continue;
      const score = candidateNameSimilarity(query, dropInitials(s.name));
      if (score < NAME_MATCH_THRESHOLD) continue;
      if (!best || score > best.score) best = { statement: s, score };
    }
    if (!best) return null;

    return {
      tier: "county_registrar",
      sourceName: SOURCE_NAME,
      sourceUrl: best.statement.sourceUrl,
      official: true,
      matchedName: best.statement.name,
      statement: clamp(best.statement.statement, MAX_STATEMENT_CHARS),
    };
  } catch {
    // DB error or unexpected payload shape — degrade to "no data from this tier".
    return null;
  }
}
