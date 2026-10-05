import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "cheerio";
import { z } from "zod/v4";

import type { OfficialGuidePayload } from "@acme/api/lib/official-guide-cache";
import { propositionGuideHash } from "@acme/api/lib/measure-relationships";
import { officialGuidePayloadSchema } from "@acme/api/lib/official-guide-cache";
import { measureRelationshipSchema } from "@acme/validators";

import {
  GUIDE_BASE,
  guideElectionDate,
  guideLinks,
  parseGuideMeasure,
} from "./ca-official-guide-parser.js";
import { fetchGuidePage } from "./ca-official-guide-source.js";
import { fetchRelationshipDocument } from "./measure-relationship-source.js";

export const relationshipCorpusSchema = z.object({
  guide: officialGuidePayloadSchema,
  sources: z.array(measureRelationshipSchema.shape.sources.element).max(200),
});
export type RelationshipCorpus = z.infer<typeof relationshipCorpusSchema>;
export const sourceHash = (text: string | Buffer) =>
  createHash("sha256").update(text).digest("hex");

/** Capture source documents once per measure, before any pair or explanation exists. */
export async function captureMeasureSources(
  guide: OfficialGuidePayload,
  measure: OfficialGuidePayload["measures"][number],
) {
  if (!measure.fullTextUrl)
    throw new Error(`Missing legal text for ${measure.number}`);
  const url = `${measure.sourceUrl}analysis.htm`;
  const html = await fetchGuidePage(url);
  const $ = load(html);
  if (
    guideElectionDate(html) !== guide.electionDate ||
    $("#propNum").text().trim() !== measure.number ||
    $(".propName h2").text().replace(/\s+/g, " ").trim() !== measure.title
  )
    throw new Error("Analysis election/measure identity mismatch");
  const analysis =
    $("#mainCont").text().replace(/\s+/g, " ").trim() +
    " " +
    $("#mainCont img")
      .map((_, image) => $(image).attr("alt") ?? "")
      .get()
      .join(" ");
  if (analysis.length < 250) throw new Error("Missing official analysis text");
  const bytes = await fetchRelationshipDocument(measure.fullTextUrl);
  const directory = await mkdtemp(join(tmpdir(), "billion-relationship-"));
  let legal: string;
  try {
    const path = join(directory, "source.pdf");
    await writeFile(path, bytes);
    legal = execFileSync("pdftotext", ["-layout", path, "-"], {
      maxBuffer: 200000,
    }).toString("utf8");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  if (!legal.includes(`PROPOSITION ${measure.number}`))
    throw new Error("Legal text heading mismatch");
  const retrievedAt = new Date().toISOString();
  return [
    {
      id: `law-${measure.number}`,
      number: measure.number,
      role: "legal-text" as const,
      url: measure.fullTextUrl,
      locator: `Proposition ${measure.number}, full proposed law; see claim-specific section locators`,
      retrievedAt,
      snapshot: legal,
      hash: sourceHash(legal),
      documentHash: sourceHash(bytes),
    },
    {
      id: `analysis-${measure.number}`,
      number: measure.number,
      role: "official-analysis" as const,
      url,
      locator: `Proposition ${measure.number}, official LAO analysis including image descriptions`,
      retrievedAt,
      snapshot: analysis,
      hash: sourceHash(analysis),
      documentHash: sourceHash(html),
    },
  ];
}

/** Discover every guide measure; a budget overflow fails rather than silently sampling. */
export async function collectRelationshipCorpus(
  electionDate: string,
  maxMeasures: number,
  dependencies = {
    fetchPage: fetchGuidePage,
    captureSources: captureMeasureSources,
  },
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(electionDate) ||
    !Number.isInteger(maxMeasures) ||
    maxMeasures < 1 ||
    maxMeasures > 100
  )
    throw new Error("Exact election date and maxMeasures 1–100 required");
  const index = await dependencies.fetchPage(`${GUIDE_BASE}/propositions/`);
  if (guideElectionDate(index) !== electionDate)
    throw new Error("Election mismatch");
  const pages = guideLinks(index, "measures");
  if (!pages.length || pages.length > maxMeasures)
    throw new Error(
      "Guide measure count exceeds budget or is empty; increase maxMeasures explicitly",
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
  for (const url of pages) {
    const html = await dependencies.fetchPage(url);
    if (guideElectionDate(html) !== electionDate)
      throw new Error("Election changed during capture");
    const measure = parseGuideMeasure(html, url, electionDate);
    if (!measure) throw new Error(`Missing measure: ${url}`);
    guide.measures.push(measure);
  }
  const sources = [];
  for (const measure of guide.measures)
    sources.push(...(await dependencies.captureSources(guide, measure)));
  return relationshipCorpusSchema.parse({ guide, sources });
}
export function relationshipIdentities(guide: OfficialGuidePayload) {
  return guide.measures.map((m) => ({
    number: m.number,
    title: m.title,
    url: m.sourceUrl,
    guideHash: propositionGuideHash(guide.electionDate, m),
  }));
}
