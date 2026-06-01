/**
 * Shared types for the candidate enrichment pipeline.
 *
 * This mirrors the ballot-measure pipeline (see ../measure-sources/types.ts):
 * every field we surface about a candidate is tagged with where it came from so
 * the app can show source attribution and the cross-validation engine can merge
 * conflicting sources by trust priority. The candidate merge engine lives in
 * ../candidate-crossvalidate.ts; this file holds types and small shared helpers
 * only.
 *
 * We deliberately REUSE the measure pipeline's trust tiers and citation shape so
 * candidates and measures share one attribution model.
 */

import type {
  MeasureArgument,
  MeasureCitation,
  SourceTier,
} from "../measure-sources/types";
import { SOURCE_TIER_RANK } from "../measure-sources/types";

// Re-export the reused primitives so candidate-source adapters can import them
// from one place rather than reaching back into measure-sources.
export type { MeasureArgument, MeasureCitation, SourceTier };
export { SOURCE_TIER_RANK };

/**
 * A contact channel (social handle, etc.) as Google Civic provides it. Shape
 * matches the `Channel` interface in civic.ts so values pass through untouched.
 */
export interface CandidateChannel {
  type: string;
  id: string;
}

/**
 * The data a single source can contribute about one candidate. Sources fill in
 * whatever fields they have; the cross-validation engine merges these
 * field-by-field, preferring the highest trust tier per field.
 *
 * Adapters must be best-effort: gate on their API key, never throw, and return
 * `null` (not a partially-populated object) when they cannot match a candidate.
 */
export interface CandidateSourceData {
  tier: SourceTier;
  sourceName: string;
  sourceUrl?: string;
  /** True only for official government sources; aggregators are false. */
  official: boolean;
  /** Candidate name as the source knows it — used for fuzzy matching audit. */
  matchedName?: string;

  biography?: string;
  photoUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  /** True when this source says the candidate currently holds the office. */
  incumbent?: boolean;
  channels?: CandidateChannel[];
}

/**
 * The canonical, merged candidate record produced by the cross-validation
 * engine. Every populated field has a corresponding entry in `citations`
 * (and only fields that were actually surfaced are cited).
 */
export interface CanonicalCandidate {
  name: string;
  party?: string;
  biography?: string;
  photoUrl?: string;
  candidateUrl?: string;
  email?: string;
  phone?: string;
  incumbent?: boolean;
  channels?: CandidateChannel[];
  citations: MeasureCitation[];
}

/**
 * Input describing a candidate as Google Civic gives it to us, plus the contest
 * context the adapters need for disambiguation (office, district, level/roles).
 */
export interface CandidateInput {
  name: string;
  party?: string;
  office?: string;
  district?: string;
  roles?: string[];
  level?: string[];
}

/**
 * Context shared with the measure pipeline. Re-declared here (rather than
 * imported) to avoid a dependency from this leaf types module onto the
 * cross-validate engine; the shape intentionally matches
 * `CrossValidateContext` in ../measure-crossvalidate.ts.
 */
export interface CandidateCrossValidateContext {
  stateAbbrev?: string;
  county?: string;
  electionYear: number;
}

/**
 * Build a citation for a field surfaced from a given source. Mirrors the
 * measure pipeline's local `cite()` but typed for candidate sources; exported
 * so the merge engine and any adapter helpers share one implementation.
 */
export function candidateCite(
  field: string,
  src: Pick<
    CandidateSourceData,
    "sourceName" | "sourceUrl" | "tier" | "official"
  >,
): MeasureCitation {
  return {
    field,
    sourceName: src.sourceName,
    sourceUrl: src.sourceUrl,
    tier: src.tier,
    official: src.official,
  };
}

/**
 * Sort source data by trust tier, highest first. Stable for equal tiers.
 * The merge engine uses this so the first source holding a field wins.
 */
export function byTierDesc(
  a: Pick<CandidateSourceData, "tier">,
  b: Pick<CandidateSourceData, "tier">,
): number {
  return SOURCE_TIER_RANK[b.tier] - SOURCE_TIER_RANK[a.tier];
}

/**
 * Rough name similarity (0..1) for matching a candidate across sources whose
 * names vary (nicknames, middle names, suffixes). Token Jaccard over
 * lowercased, punctuation-stripped words. Mirrors the word-overlap approach
 * used for measure titles. Callers typically accept a match at >= 0.7.
 */
export function candidateNameSimilarity(a: string, b: string): number {
  const tokens = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean),
    );
  const wa = tokens(a);
  const wb = tokens(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersection = 0;
  for (const t of wa) if (wb.has(t)) intersection += 1;
  const union = wa.size + wb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Drop single-letter tokens (middle initials) so "Tony K. Thurmond" ≈ "Tony Thurmond". */
export function dropInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((t) => t.replace(/[^A-Za-z0-9]/g, "").length > 1)
    .join(" ");
}

/** Clamp prose to a max length, adding an ellipsis when truncated. */
export function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/**
 * Deterministic JSON string for cache keys (sorted keys). Shared by the
 * candidate cache, the scraper handoff write, and the registrar adapter read so
 * a written `params` byte-matches the read `params` — a mismatch is a silent
 * cache miss.
 */
export function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
