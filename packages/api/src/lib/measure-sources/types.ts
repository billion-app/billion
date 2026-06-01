/**
 * Shared types for the ballot-measure enrichment pipeline.
 *
 * Every piece of measure data we surface is tagged with where it came from so
 * the app can show source attribution and so the cross-validation engine can
 * merge conflicting sources by trust priority. See the implementation plan in
 * docs/MEASURE_ENRICHMENT.md.
 */

/**
 * Trust tiers, highest to lowest. The cross-validation engine prefers data
 * from a higher tier when multiple sources cover the same field.
 *
 * County registrar / State SOS (official) > League of Women Voters
 * (nonpartisan) > Ballotpedia (aggregator) > Wikipedia (encyclopedic) >
 * Vote Smart > Google Civic > AI grounded on fetched text (last resort).
 */
export type SourceTier =
  | "county_registrar"
  | "state_sos"
  | "lwv"
  | "ballotpedia"
  | "wikipedia"
  | "vote_smart"
  | "google_civic"
  | "ai_generated";

export const SOURCE_TIER_RANK: Record<SourceTier, number> = {
  county_registrar: 8,
  state_sos: 7,
  lwv: 6,
  ballotpedia: 5,
  wikipedia: 4,
  vote_smart: 3,
  google_civic: 2,
  ai_generated: 1,
};

/** A single argument for/against a measure, with attribution where available. */
export interface MeasureArgument {
  text: string;
  /** Who wrote it (e.g. "Sen. Jane Doe", "League of Women Voters"). */
  author?: string;
  sourceName: string;
  sourceUrl?: string;
}

/** A citation describing which source supplied a given field. */
export interface MeasureCitation {
  /** Which field this citation backs (e.g. "summary", "fiscalImpact"). */
  field: string;
  sourceName: string;
  sourceUrl?: string;
  tier: SourceTier;
  /** True for official government sources (SOS, county registrar). */
  official: boolean;
}

/**
 * The data a single source can contribute about one measure. Sources fill in
 * whatever fields they have; the cross-validation engine merges these.
 */
export interface MeasureSourceData {
  tier: SourceTier;
  sourceName: string;
  sourceUrl?: string;
  official: boolean;
  /** Title as the source knows it — used for fuzzy matching. */
  matchedTitle?: string;

  officialSummary?: string;
  fiscalImpact?: string;
  fullText?: string;
  fullTextUrl?: string;
  proArguments?: MeasureArgument[];
  conArguments?: MeasureArgument[];
  /** Single pro/con statement (Google Civic shape) when no list is available. */
  proStatement?: string;
  conStatement?: string;
}

/**
 * The canonical, merged measure record produced by the cross-validation
 * engine. Every populated field has a corresponding entry in `citations`.
 */
export interface CanonicalMeasure {
  title: string;
  summary?: string;
  /** One-sentence summary for list/card previews (AI or first sentence). */
  summaryShort?: string;
  /** Fuller plain-language summary for the detail screen. */
  summaryLong?: string;
  /** True when `summary` was produced by AI with no official source text. */
  summaryIsAiGenerated?: boolean;
  fiscalImpact?: string;
  fullText?: string;
  fullTextUrl?: string;
  proArguments: MeasureArgument[];
  conArguments: MeasureArgument[];
  citations: MeasureCitation[];
  /** Fields where sources disagreed, flagged for human review. */
  discrepancies?: string[];
}
