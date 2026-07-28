import { createHash } from "node:crypto";
import { APICallError, generateText, Output, RetryError } from "ai";
import pLimit from "p-limit";
import { z } from "zod";

import type { BillAnalysis, BillSectionNotes } from "@acme/validators";
import {
  BillAnalysisFindingSchema,
  BillAnalysisSchema,
  BillSectionNotesSchema,
} from "@acme/validators";

import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { getStructuredLlm } from "./provider.js";
import {
  AIRateLimitError,
  rateLimitHit,
  setRateLimitHit,
} from "./text-generation.js";

const logger = createLogger("bill-analysis");

/**
 * Each analysis call sees at most one legislative section. Exceptionally long
 * sections are split into overlapping parts so a pathological section cannot
 * recreate the old whole-document context-window failure.
 */
export const BILL_SECTION_CHUNK_LIMIT = 14_000;
const BILL_SECTION_CHUNK_OVERLAP = 600;
const MAX_ANALYSIS_ATTEMPTS = 2;

export interface BillSourceSection {
  id: string;
  locator: string;
  start: number;
  end: number;
  text: string;
}

interface SectionBoundary {
  start: number;
  locator: string;
}

const SECTION_MARKER = /\b(?:SEC\.|SECTION)\s+\d+[A-Z0-9-]*\./g;
const SECTION_LOCATOR =
  /^((?:SEC\.|SECTION)\s+\d+[A-Z0-9-]*\.(?:\s+[A-Z][A-Z0-9 ,;:'()/–—-]{2,120}\.)?)/;

function sectionLocator(sourceText: string, start: number): string {
  return (
    SECTION_LOCATOR.exec(sourceText.slice(start, start + 300))?.[1]?.trim() ??
    /\b(?:SEC\.|SECTION)\s+\d+[A-Z0-9-]*\./.exec(
      sourceText.slice(start, start + 80),
    )?.[0] ??
    "Untitled section"
  );
}

function findSectionBoundaries(sourceText: string): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];
  SECTION_MARKER.lastIndex = 0;
  for (const match of sourceText.matchAll(SECTION_MARKER)) {
    if (match.index === undefined) continue;
    boundaries.push({
      start: match.index,
      locator: sectionLocator(sourceText, match.index),
    });
  }
  return boundaries;
}

function splitRange(
  sourceText: string,
  start: number,
  end: number,
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let cursor = start;

  while (cursor < end) {
    const hardEnd = Math.min(cursor + BILL_SECTION_CHUNK_LIMIT, end);
    let chunkEnd = hardEnd;
    if (hardEnd < end) {
      const minimumEnd = cursor + Math.floor(BILL_SECTION_CHUNK_LIMIT * 0.7);
      const whitespace = sourceText.lastIndexOf(" ", hardEnd);
      if (whitespace >= minimumEnd) chunkEnd = whitespace;
    }
    ranges.push({ start: cursor, end: chunkEnd });
    if (chunkEnd >= end) break;
    cursor = Math.max(cursor + 1, chunkEnd - BILL_SECTION_CHUNK_OVERLAP);
  }

  return ranges;
}

/**
 * Inventory the whole source using the bill's own SEC./SECTION markers. The
 * preamble is retained as its own unit, and markerless or oversized documents
 * fall back to bounded overlapping parts. Every source character is covered.
 */
export function splitBillIntoSections(sourceText: string): BillSourceSection[] {
  if (!sourceText.length) return [];

  const markers = findSectionBoundaries(sourceText);
  let boundaries: SectionBoundary[];
  if (markers.length === 0) {
    boundaries = [{ start: 0, locator: "Full text" }];
  } else {
    const first = markers[0]!;
    const prefix = sourceText.slice(0, first.start);
    boundaries =
      first.start === 0
        ? markers
        : prefix.trim()
          ? [{ start: 0, locator: "Preamble" }, ...markers]
          : [{ ...first, start: 0 }, ...markers.slice(1)];
  }
  const sections: BillSourceSection[] = [];

  boundaries.forEach((boundary, sectionIndex) => {
    const logicalEnd = boundaries[sectionIndex + 1]?.start ?? sourceText.length;
    const parts = splitRange(sourceText, boundary.start, logicalEnd);
    parts.forEach((part, partIndex) => {
      const baseId = `section-${String(sectionIndex + 1).padStart(3, "0")}`;
      const partSuffix = parts.length > 1 ? `.part-${partIndex + 1}` : "";
      const partLabel =
        parts.length > 1
          ? `${boundary.locator} (part ${partIndex + 1} of ${parts.length})`
          : boundary.locator;
      sections.push({
        id: `${baseId}${partSuffix}`,
        locator: partLabel,
        start: part.start,
        end: part.end,
        text: sourceText.slice(part.start, part.end),
      });
    });
  });

  assertCompleteSectionCoverage(sections, sourceText.length);
  return sections;
}

/** Throw if a splitter regression omits any portion of the source. */
export function assertCompleteSectionCoverage(
  sections: readonly BillSourceSection[],
  sourceLength: number,
): void {
  if (sourceLength === 0 && sections.length === 0) return;
  if (sections.length === 0 || sections[0]!.start !== 0) {
    throw new Error("Bill section inventory does not start at source offset 0");
  }

  let coveredThrough = 0;
  for (const section of sections) {
    if (section.start > coveredThrough) {
      throw new Error(
        `Bill section inventory has a gap before source offset ${section.start}`,
      );
    }
    if (section.end <= section.start) {
      throw new Error(`Bill section ${section.id} is empty`);
    }
    coveredThrough = Math.max(coveredThrough, section.end);
  }
  if (coveredThrough !== sourceLength) {
    throw new Error(
      `Bill section inventory ends at ${coveredThrough}, expected ${sourceLength}`,
    );
  }
}

const GeneratedAnalysisQuoteSchema = z.object({
  text: z.string().trim().min(20).max(1600),
  locator: z.string().trim().max(160).nullish(),
});
const GeneratedAnalysisFindingSchema = BillAnalysisFindingSchema.extend({
  quote: GeneratedAnalysisQuoteSchema.nullish(),
});
const GeneratedSectionNotesSchema = BillSectionNotesSchema.omit({
  sectionId: true,
  locator: true,
}).extend({
  findings: z.array(GeneratedAnalysisFindingSchema).max(30),
});

function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== null)
      .map(([key, child]) => [key, withoutNulls(child)]),
  );
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota")
  );
}

function buildSectionAnalysisPrompt(args: {
  billNumber: string;
  section: BillSourceSection;
}): string {
  return `You are performing the reading pass for a legislative brief. Analyze exactly one source section and return structured notes, not reader-facing prose.

The later writing pass will never see the raw bill text. Your notes must therefore preserve every material mechanism needed to explain the bill accurately.

Use a facet-based inventory:
- changes to law, authority, eligibility, duties, rights, funding, deadlines, effective dates, implementation, and oversight
- every penalty, enforcement mechanism, exemption, exception, condition, definition, and cross-reference
- the actor taking an action and each party directly affected
- uncertainties that are genuinely left open by this section

Rules:
- Be exhaustive within this section, even when a provision seems secondary.
- Give each distinct mechanism its own finding. Do not collapse a penalty, exemption, or deadline into a general summary.
- A finding must be self-contained and say who does what, to whom, under what condition, and when the text supplies those details.
- Copy a supporting quote exactly when it would let the writer substantiate a concrete mechanism, number, date, penalty, exemption, or definition. Never paraphrase inside "quote.text".
- Use the most specific subsection label available in "quote.locator".
- Record cross-references; do not guess what referenced law currently says.
- Do not treat findings, purpose clauses, the bill title, or sponsor language as proof of real-world effects.
- Set "substantive" to false only for a table of contents or boilerplate with no operative or interpretive content. An amendment, definition, effective date, or severability clause is substantive.
- Do not claim that something is absent from the entire bill. You can only say it is not specified in this section.

Bill: ${args.billNumber}
Inventory unit: ${args.section.id}
Locator: ${args.section.locator}
Source offsets: ${args.section.start}-${args.section.end}

<section>
${args.section.text}
</section>

Return the structured notes now.`;
}

async function analyzeSection(
  billNumber: string,
  section: BillSourceSection,
): Promise<BillSectionNotes> {
  for (let attempt = 1; attempt <= MAX_ANALYSIS_ATTEMPTS; attempt++) {
    try {
      const { output, usage } = await generateText({
        model: getStructuredLlm(),
        output: Output.object({ schema: GeneratedSectionNotesSchema }),
        prompt: buildSectionAnalysisPrompt({ billNumber, section }),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      const generated = GeneratedSectionNotesSchema.parse(withoutNulls(output));
      return BillSectionNotesSchema.parse({
        ...generated,
        sectionId: section.id,
        locator: section.locator,
      });
    } catch (error) {
      if (isRateLimitError(error)) {
        setRateLimitHit(true);
        throw new AIRateLimitError();
      }
      if (attempt === MAX_ANALYSIS_ATTEMPTS) throw error;
      logger.warn(
        `Analysis failed for ${billNumber} ${section.id}; retrying`,
        error,
      );
    }
  }
  throw new Error(
    `Analysis exhausted attempts for ${billNumber} ${section.id}`,
  );
}

/**
 * Read every inventoried source section and return coverage-checked notes.
 * Any failed section fails the pass: the writer never receives partial notes
 * and therefore cannot mistake an unvisited section for evidence of absence.
 */
export async function analyzeBill(args: {
  billNumber: string;
  fullText: string;
}): Promise<BillAnalysis> {
  if (rateLimitHit) throw new AIRateLimitError();

  const sourceSections = splitBillIntoSections(args.fullText);
  if (sourceSections.length === 0) {
    throw new Error(`Cannot analyze empty bill text for ${args.billNumber}`);
  }

  const configuredConcurrency = Number(
    process.env.BILL_ANALYSIS_CONCURRENCY ?? 3,
  );
  const concurrency = Number.isFinite(configuredConcurrency)
    ? Math.min(8, Math.max(1, Math.floor(configuredConcurrency)))
    : 3;
  const limit = pLimit(concurrency);
  const sections = await Promise.all(
    sourceSections.map((section) =>
      limit(() => analyzeSection(args.billNumber, section)),
    ),
  );
  const analyzedSectionIds = sections.map((section) => section.sectionId);
  const expectedSectionIds = sourceSections.map((section) => section.id);
  if (
    analyzedSectionIds.length !== expectedSectionIds.length ||
    analyzedSectionIds.some((id, index) => id !== expectedSectionIds[index])
  ) {
    throw new Error(`Incomplete bill analysis coverage for ${args.billNumber}`);
  }

  const analysis = BillAnalysisSchema.parse({
    sourceLength: args.fullText.length,
    sourceHash: createHash("sha256").update(args.fullText).digest("hex"),
    sectionCount: sourceSections.length,
    analyzedSectionIds,
    sections,
  });
  logger.success(
    `Analyzed ${args.billNumber}: ${analysis.sectionCount} section unit(s), ${analysis.sections.reduce((sum, section) => sum + section.findings.length, 0)} finding(s)`,
  );
  return analysis;
}

/** Compact, lossless-enough serialization for the writing pass. */
export function formatBillAnalysis(analysis: BillAnalysis): string {
  return analysis.sections
    .map((section) => {
      const findings =
        section.findings.length > 0
          ? section.findings
              .map((finding, index) => {
                const metadata = [
                  finding.actors.length
                    ? `actors: ${finding.actors.join("; ")}`
                    : "",
                  finding.affectedParties.length
                    ? `affected: ${finding.affectedParties.join("; ")}`
                    : "",
                  finding.crossReferences.length
                    ? `cross-references: ${finding.crossReferences.join("; ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" | ");
                const quote = finding.quote
                  ? `\n   exact quote${finding.quote.locator ? ` (${finding.quote.locator})` : ""}: ${JSON.stringify(finding.quote.text)}`
                  : "";
                return `${index + 1}. [${finding.category}] ${finding.statement}${metadata ? `\n   ${metadata}` : ""}${quote}`;
              })
              .join("\n")
          : "No material findings recorded.";
      return `## ${section.sectionId} — ${section.locator}
Substantive: ${section.substantive ? "yes" : "no"}
Summary: ${section.summary}
${findings}`;
    })
    .join("\n\n");
}
