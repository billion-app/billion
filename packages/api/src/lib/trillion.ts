import { createHash } from "node:crypto";

import type { PublicTrillionGraph, TrillionGraph } from "@acme/validators";
import {
  publicTrillionGraph,
  trillionGraphSchema,
  unverifiedTrillionQuotes,
} from "@acme/validators";

import type { OfficialGuidePayload } from "./official-guide-cache";
import { propositionGuideHash } from "./proposition-consequences";

/** Generated graphs live in `civic_api_cache`, one row per measure. */
export const TRILLION_ENDPOINT = "trillion-v1";
export const TRILLION_ADDRESS_HASH = "__global__";
/** Keys in sorted order so the API's stable cache key matches the scraper's. */
export function trillionCacheParams(electionDate: string, number: string) {
  return { electionDate, number };
}

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** The official URL each source role must come from, for the cited measure. */
export function expectedTrillionSourceUrl(
  measure: OfficialGuidePayload["measures"][number],
  role: Exclude<TrillionGraph["sources"][number]["role"], "precedent">,
): string | undefined {
  if (role === "legal-text") return measure.fullTextUrl;
  if (role === "official-analysis") return `${measure.sourceUrl}analysis.htm`;
  return `${measure.sourceUrl}arguments-rebuttals.htm`;
}

export interface TrillionSourceHash {
  url: string;
  hash: string;
}

/**
 * Trillion graphs publish without human review (#455). Instead, every read
 * re-runs the machine gate and fails closed: the graph must parse, describe
 * the current guide entry, quote its captured sources verbatim, and those
 * source documents must still hash to what was captured.
 */
/** Why a stored graph may not be published, or null when it may. */
export function trillionGateProblem(
  guide: OfficialGuidePayload,
  number: string,
  value: unknown,
  currentSources: readonly TrillionSourceHash[],
): string | null {
  const parsed = trillionGraphSchema.safeParse(value);
  if (!parsed.success)
    return `schema: ${parsed.error.issues
      .slice(0, 3)
      .map((i) => i.message)
      .join("; ")}`;
  const graph = parsed.data;
  const measure = guide.measures.find((m) => m.number === number);
  if (!measure) return `Proposition ${number} is not in the guide`;
  if (
    graph.electionDate !== guide.electionDate ||
    graph.measure.number !== measure.number ||
    graph.measure.title !== measure.title ||
    graph.measure.url !== measure.sourceUrl ||
    graph.measure.guideHash !==
      propositionGuideHash(guide.electionDate, measure)
  )
    return "the guide entry changed since the graph was made";
  for (const source of graph.sources) {
    const cited = guide.measures.find((m) => m.number === source.number);
    if (!cited) return `source ${source.id} cites a measure not in the guide`;
    // Precedent comes from archived official PDFs the schema allowlists, and
    // only for the measure this graph is about.
    if (
      source.role === "precedent"
        ? source.number !== number
        : expectedTrillionSourceUrl(cited, source.role) !== source.url
    )
      return `source ${source.id} is not the expected official document`;
    if (sha256(source.snapshot) !== source.hash)
      return `source ${source.id} snapshot does not match its hash`;
    if (
      !currentSources.some(
        (current) =>
          current.url === source.url && current.hash === source.documentHash,
      )
    )
      return `source ${source.id} has no current matching fingerprint`;
  }
  for (const node of graph.nodes)
    if (
      node.record &&
      !guide.measures.some((m) => m.number === node.record?.number)
    )
      return `${node.id} names Proposition ${node.record.number}, which is not in the guide`;
  if (
    !graph.sources.some((s) => s.number === number && s.role === "legal-text")
  )
    return "the measure's legal text is missing";
  const unverified = unverifiedTrillionQuotes(graph);
  if (unverified.length) return `unverified quotes: ${unverified.join(", ")}`;
  return null;
}

export function publishedTrillionGraph(
  guide: OfficialGuidePayload,
  number: string,
  value: unknown,
  currentSources: readonly TrillionSourceHash[],
): PublicTrillionGraph | null {
  if (trillionGateProblem(guide, number, value, currentSources)) return null;
  return publicTrillionGraph(trillionGraphSchema.parse(value));
}

/** Source documents whose bytes the guide job must re-hash for freshness. */
export function trillionSourceUrls(values: readonly unknown[]): string[] {
  const urls = new Set<string>();
  for (const value of values) {
    const parsed = trillionGraphSchema.safeParse(value);
    if (parsed.success) for (const s of parsed.data.sources) urls.add(s.url);
  }
  return [...urls];
}
