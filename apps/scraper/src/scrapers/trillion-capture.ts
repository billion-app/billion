import { load } from "cheerio";
import { z } from "zod/v4";

import type { OfficialGuidePayload } from "@acme/api/lib/official-guide-cache";
import { officialGuidePayloadSchema } from "@acme/api/lib/official-guide-cache";
import { trillionSourceSchema } from "@acme/validators";

import {
  GUIDE_BASE,
  guideElectionDate,
  guideLinks,
  parseGuideMeasure,
} from "./ca-official-guide-parser.js";
import { fetchGuidePage } from "./ca-official-guide-source.js";
import {
  captureMeasureSources,
  sourceHash,
} from "./measure-relationship-capture.js";

/** Everything one Trillion generation may cite: the measure, its neighbors' law, and nothing else. */
export const trillionCorpusSchema = z.object({
  number: z.string().regex(/^\d+[A-Z]?$/),
  guide: officialGuidePayloadSchema,
  sources: z.array(trillionSourceSchema).min(3).max(12),
});
export type TrillionCorpus = z.infer<typeof trillionCorpusSchema>;
type Measure = OfficialGuidePayload["measures"][number];

/** The published arguments and rebuttals, checked against the measure's identity. */
export async function captureArgumentSource(
  guide: OfficialGuidePayload,
  measure: Measure,
  fetchPage: (url: string) => Promise<string> = fetchGuidePage,
) {
  const url = `${measure.sourceUrl}arguments-rebuttals.htm`;
  const html = await fetchPage(url);
  const $ = load(html);
  if (
    guideElectionDate(html) !== guide.electionDate ||
    $("#propNum").text().trim() !== measure.number ||
    $(".propName h2").text().replace(/\s+/g, " ").trim() !== measure.title
  )
    throw new Error("Arguments page election/measure identity mismatch");
  const text = $("#mainCont").text().replace(/\s+/g, " ").trim();
  if (text.length < 500) throw new Error("Missing official arguments text");
  return trillionSourceSchema.parse({
    id: `arguments-${measure.number}`,
    number: measure.number,
    role: "official-arguments",
    url,
    locator: `Proposition ${measure.number}, official arguments and rebuttals`,
    retrievedAt: new Date().toISOString(),
    snapshot: text,
    hash: sourceHash(text),
    documentHash: sourceHash(html),
  });
}

/**
 * Capture one measure's law, analysis and arguments, plus the legal text of
 * explicitly named related measures (for example, conflicting propositions).
 * Read-only network fetches; no model calls and no database writes.
 */
export async function collectTrillionCorpus(
  electionDate: string,
  number: string,
  related: readonly string[],
  dependencies = {
    fetchPage: fetchGuidePage,
    captureSources: captureMeasureSources,
  },
): Promise<TrillionCorpus> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(electionDate))
    throw new Error("Exact election date required");
  if (related.length > 4) throw new Error("At most four related measures");
  const wanted = [number, ...related];
  if (new Set(wanted).size !== wanted.length)
    throw new Error("Related measures must be distinct from the measure");
  const index = await dependencies.fetchPage(`${GUIDE_BASE}/propositions/`);
  if (guideElectionDate(index) !== electionDate)
    throw new Error("Election mismatch");
  const pages = new Map(
    guideLinks(index, "measures").flatMap((url) => {
      const match = /\/propositions\/(\d+[a-z]?)\/?$/i.exec(url);
      return match?.[1] ? [[match[1].toUpperCase(), url] as const] : [];
    }),
  );
  const guide = officialGuidePayloadSchema.parse({
    electionDate,
    jurisdiction: "CA",
    complete: true,
    fetchedAt: new Date().toISOString(),
    sourceUrl: `${GUIDE_BASE}/`,
    measures: [],
    candidates: [],
  });
  for (const wantedNumber of wanted) {
    const url = pages.get(wantedNumber);
    if (!url)
      throw new Error(`Proposition ${wantedNumber} is not in the guide`);
    const html = await dependencies.fetchPage(url);
    if (guideElectionDate(html) !== electionDate)
      throw new Error("Election changed during capture");
    const measure = parseGuideMeasure(html, url, electionDate);
    if (!measure) throw new Error(`Missing measure: ${url}`);
    guide.measures.push(measure);
  }
  const [main, ...others] = guide.measures;
  if (!main) throw new Error("Measure missing");
  const sources = [
    ...(await dependencies.captureSources(guide, main)),
    await captureArgumentSource(guide, main, dependencies.fetchPage),
  ];
  for (const measure of others)
    sources.push(
      ...(await dependencies.captureSources(guide, measure)).filter(
        (source) => source.role === "legal-text",
      ),
    );
  return trillionCorpusSchema.parse({ number, guide, sources });
}
