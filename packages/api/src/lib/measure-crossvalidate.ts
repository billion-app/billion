/**
 * Cross-validation engine for ballot measures.
 *
 * Collects measure data from every available source (county registrar, state
 * SOS, Vote Smart, Google Civic, AI fallback), then merges them field-by-field
 * by trust priority into a single canonical record with full source
 * attribution. Discrepancies between sources are flagged for human review.
 *
 * Guiding principle (from the implementation plan): AI structures and
 * reconciles, it does not author. Official sources win. Every surfaced field
 * carries a citation. AI-only summaries are explicitly labeled.
 */

import type {
  CanonicalMeasure,
  MeasureArgument,
  MeasureCitation,
  MeasureSourceData,
} from "./measure-sources/types";
import { generateMeasureSummary } from "./civic-ai";
import { enrichFromBallotpedia } from "./measure-sources/ballotpedia";
import { enrichFromCaSos } from "./measure-sources/ca-sos-voterguide";
import { enrichFromCaVotes } from "./measure-sources/cavotes";
import { collectGroundingText } from "./measure-sources/grounded-fallback";
import { SOURCE_TIER_RANK } from "./measure-sources/types";
import { enrichFromWikipedia } from "./measure-sources/wikipedia";
import { enrichFromVoteSmart } from "./votesmart";

export interface CrossValidateContext {
  stateAbbrev?: string;
  county?: string;
  electionYear: number;
}

/** A measure as Google Civic gives it to us — the lowest-tier source. */
export interface CivicMeasureInput {
  title: string;
  subtitle?: string;
  text?: string;
  url?: string;
  proStatement?: string;
  conStatement?: string;
}

/**
 * Map the existing Vote Smart enrichment into the unified source shape.
 */
async function collectVoteSmart(
  title: string,
  ctx: CrossValidateContext,
): Promise<MeasureSourceData | null> {
  if (!ctx.stateAbbrev) return null;
  const vs = await enrichFromVoteSmart(
    title,
    ctx.stateAbbrev,
    ctx.electionYear,
  ).catch(() => null);
  if (!vs) return null;
  return {
    tier: "vote_smart",
    sourceName: vs.source || "Vote Smart",
    sourceUrl: vs.voteSmartUrl ?? vs.textUrl,
    official: false,
    matchedTitle: title,
    officialSummary: vs.summary,
    fullText: vs.measureText,
    fullTextUrl: vs.textUrl,
    proArguments: vs.proUrl
      ? [
          {
            text: "See official pro arguments",
            sourceName: "Vote Smart",
            sourceUrl: vs.proUrl,
          },
        ]
      : undefined,
    conArguments: vs.conUrl
      ? [
          {
            text: "See official con arguments",
            sourceName: "Vote Smart",
            sourceUrl: vs.conUrl,
          },
        ]
      : undefined,
  };
}

/** The Google Civic measure itself, as the lowest-trust source. */
function civicAsSource(input: CivicMeasureInput): MeasureSourceData {
  return {
    tier: "google_civic",
    sourceName: "Google Civic Information API",
    sourceUrl: input.url,
    official: false,
    matchedTitle: input.title,
    officialSummary: input.subtitle,
    fullText: input.text,
    fullTextUrl: input.url,
    proStatement: input.proStatement,
    conStatement: input.conStatement,
  };
}

/** Sort sources by trust tier, highest first. */
function byTierDesc(a: MeasureSourceData, b: MeasureSourceData): number {
  return SOURCE_TIER_RANK[b.tier] - SOURCE_TIER_RANK[a.tier];
}

function cite(field: string, src: MeasureSourceData): MeasureCitation {
  return {
    field,
    sourceName: src.sourceName,
    sourceUrl: src.sourceUrl,
    tier: src.tier,
    official: src.official,
  };
}

/** Rough similarity for discrepancy detection on summary text. */
function looksDifferent(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  const wa = new Set(norm(a));
  const wb = new Set(norm(b));
  if (wa.size === 0 || wb.size === 0) return false;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.max(wa.size, wb.size) < 0.4;
}

/**
 * Collect from all sources and merge into a canonical, source-attributed
 * measure record. Sources are fetched concurrently; any that fail are skipped.
 */
export async function crossValidateMeasure(
  input: CivicMeasureInput,
  ctx: CrossValidateContext,
): Promise<CanonicalMeasure> {
  const [sos, lwv, bp, wiki, vs] = await Promise.all([
    enrichFromCaSos(input.title, ctx.stateAbbrev, ctx.electionYear).catch(
      () => null,
    ),
    enrichFromCaVotes(input.title, ctx.stateAbbrev, ctx.electionYear).catch(
      () => null,
    ),
    enrichFromBallotpedia(input.title, {
      stateAbbrev: ctx.stateAbbrev,
      county: ctx.county,
      electionYear: ctx.electionYear,
    }).catch(() => null),
    enrichFromWikipedia(input.title, ctx.stateAbbrev, ctx.electionYear).catch(
      () => null,
    ),
    collectVoteSmart(input.title, ctx),
  ]);

  const sources: MeasureSourceData[] = [
    sos,
    lwv,
    bp,
    wiki,
    vs,
    civicAsSource(input),
  ].filter((s): s is MeasureSourceData => s !== null);
  sources.sort(byTierDesc);

  const citations: MeasureCitation[] = [];
  const discrepancies: string[] = [];

  // --- Summary: take the highest-tier source that has one. ---
  let summary: string | undefined;
  let summaryIsAiGenerated = false;
  for (const src of sources) {
    if (src.officialSummary) {
      if (summary && looksDifferent(summary, src.officialSummary)) {
        // already have a higher-tier summary; note the disagreement
        discrepancies.push(
          `Summary differs between ${citations.find((c) => c.field === "summary")?.sourceName} and ${src.sourceName}`,
        );
      } else if (!summary) {
        summary = src.officialSummary;
        citations.push(cite("summary", src));
      }
    }
  }

  // --- Fiscal impact: highest-tier source with one. ---
  let fiscalImpact: string | undefined;
  for (const src of sources) {
    if (src.fiscalImpact && !fiscalImpact) {
      fiscalImpact = src.fiscalImpact;
      citations.push(cite("fiscalImpact", src));
      break;
    }
  }

  // --- Full text URL / text: prefer official, then any. ---
  let fullText: string | undefined;
  let fullTextUrl: string | undefined;
  for (const src of sources) {
    if (src.fullText && !fullText) {
      fullText = src.fullText;
      citations.push(cite("fullText", src));
    }
    if (src.fullTextUrl && !fullTextUrl) {
      fullTextUrl = src.fullTextUrl;
    }
  }

  // --- Pro / con arguments: collect from all sources, dedupe, attribute. ---
  const proArguments = collectArguments(sources, "pro", citations);
  const conArguments = collectArguments(sources, "con", citations);

  // --- AI fallback (last resort): summarize REAL fetched source text only. ---
  // No human/aggregator source had a summary. Rather than show a blank card, we
  // gather real text about the measure (Google Civic's own fields, else fetched
  // from nonpartisan sources) and let the AI summarize THAT — never the title
  // alone. The summary is labeled AI-generated and cites the text it came from,
  // staying true to the principle: always point back to the original source.
  if (!summary) {
    const civicMaterial = [
      input.subtitle,
      input.text,
      input.proStatement,
      input.conStatement,
    ]
      .filter(Boolean)
      .join("\n\n");

    let groundingText = civicMaterial;
    let groundingSources: { name: string; url: string }[] = input.url
      ? [{ name: "Google Civic Information API", url: input.url }]
      : [];

    if (groundingText.trim().length < 250) {
      const fetched = await collectGroundingText(input.title, {
        electionYear: ctx.electionYear,
        county: ctx.county,
      }).catch(() => null);
      if (fetched) {
        groundingText = fetched.text;
        groundingSources = fetched.sources;
      }
    }

    try {
      summary = await generateMeasureSummary(input.title, groundingText);
      summaryIsAiGenerated = true;
      // Cite the AI step itself, plus the real sources it was grounded on, so
      // the reader can follow the summary back to the underlying material.
      citations.push({
        field: "summary",
        sourceName: "AI summary — grounded on the sources below, not an official source",
        tier: "ai_generated",
        official: false,
      });
      for (const gs of groundingSources) {
        citations.push({
          field: "summary",
          sourceName: gs.name,
          sourceUrl: gs.url,
          tier: "ai_generated",
          official: false,
        });
      }
      if (!fullTextUrl && groundingSources[0]?.url) {
        fullTextUrl = groundingSources[0].url;
      }
    } catch {
      // Not enough real source text → leave summary undefined; the UI shows
      // "No information available" rather than a hallucinated guess.
    }
  }

  return {
    title: input.title,
    summary,
    summaryIsAiGenerated,
    fiscalImpact,
    fullText,
    fullTextUrl,
    proArguments,
    conArguments,
    citations,
    discrepancies: discrepancies.length ? discrepancies : undefined,
  };
}

function collectArguments(
  sources: MeasureSourceData[],
  side: "pro" | "con",
  citations: MeasureCitation[],
): MeasureArgument[] {
  const out: MeasureArgument[] = [];
  const seen = new Set<string>();
  let cited = false;
  for (const src of sources) {
    const list = side === "pro" ? src.proArguments : src.conArguments;
    if (list) {
      for (const arg of list) {
        const key = arg.text.slice(0, 80).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(arg);
      }
      if (!cited && list.length) {
        citations.push(
          cite(side === "pro" ? "proArguments" : "conArguments", src),
        );
        cited = true;
      }
    }
    // Single-statement (Google Civic) fallback when no structured list exists.
    const stmt = side === "pro" ? src.proStatement : src.conStatement;
    if (stmt && out.length === 0) {
      const key = stmt.slice(0, 80).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          text: stmt,
          sourceName: src.sourceName,
          sourceUrl: src.sourceUrl,
        });
        if (!cited) {
          citations.push(
            cite(side === "pro" ? "proArguments" : "conArguments", src),
          );
          cited = true;
        }
      }
    }
  }
  return out;
}
