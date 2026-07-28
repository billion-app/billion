import { APICallError, generateText, Output, RetryError } from "ai";
import { z } from "zod";

import type { BillSectionEvidence, BillSectionNotes } from "@acme/validators";
import { BillSectionNotesSchema } from "@acme/validators";

import { trackLLMUsage } from "../costs.js";
import { getStructuredLlm } from "./provider.js";
import { AIRateLimitError, setRateLimitHit } from "./text-generation.js";

export const BILL_ANALYSIS_PROMPT_VERSION = "section-mechanisms-v1";
export const DEFAULT_BILL_ANALYSIS_INPUT_TOKEN_BUDGET = 16_000;
const MIN_INPUT_TOKEN_BUDGET = 2_000;
const ANALYSIS_OUTPUT_TOKEN_BUDGET = 2_000;

const GeneratedEvidenceSchema = z.object({
  quote: z.string().trim().min(1),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().positive(),
});

const GeneratedNotesSchema = BillSectionNotesSchema.extend({
  summary: z.string().trim().min(1).max(1_200),
  provisions: z
    .array(
      BillSectionNotesSchema.shape.provisions.element.extend({
        evidence: z.array(GeneratedEvidenceSchema).min(1).max(6),
      }),
    )
    .max(30),
});

export interface BillSectionForAnalysis {
  id: string;
  structuralPath: string;
  heading: string | null;
  displayedNumber: string | null;
  order: number;
  text: string;
  sectionHash: string;
  sourceStartOffset: number | null;
  sourceEndOffset: number | null;
}

interface SectionChunk {
  text: string;
  startOffset: number;
}

function configuredInputTokenBudget(): number {
  const configured = Number(process.env.BILL_ANALYSIS_INPUT_TOKEN_BUDGET);
  return Number.isInteger(configured) && configured >= MIN_INPUT_TOKEN_BUDGET
    ? configured
    : DEFAULT_BILL_ANALYSIS_INPUT_TOKEN_BUDGET;
}

/**
 * UTF-8 bytes are a conservative upper bound for modern subword tokenizers.
 * Keeping the entire prompt below this value prevents an unexpectedly dense
 * statute or non-ASCII text from exceeding the configured input budget.
 */
export function conservativeTokenUpperBound(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function sectionLabel(section: BillSectionForAnalysis): string {
  return (
    [section.displayedNumber, section.heading].filter(Boolean).join(" — ") ||
    section.structuralPath
  );
}

export function buildSectionAnalysisPrompt(args: {
  section: BillSectionForAnalysis;
  excerpt: string;
  excerptStartOffset: number;
}): string {
  return `You are taking structured, evidence-grounded notes on one section of a U.S. bill. These notes will be the only bill-text input available to a later writer.

Extract each operative provision separately. Classify it as one of: change, binding, effective_date, penalty, exemption, definition, cross_reference, funding, oversight, or other. Record who or what it applies to in subjects. Prefer specific mechanisms over general purpose language.

Coverage rules:
- Look explicitly for duties, prohibitions, eligibility, discretion, money, deadlines, effective dates, penalties, exemptions, definitions, and cross-references.
- Do not infer current law, intent, effects, or absence beyond this excerpt.
- Every provision needs at least one exact, unedited evidence quote from the excerpt.
- Evidence offsets are zero-based within this excerpt and end-exclusive.
- Preserve numbers, thresholds, dates, exceptions, and enforcement language.
- Return an empty provisions array only when the excerpt contains no operative provision.

Section: ${sectionLabel(args.section)}
Structural path: ${args.section.structuralPath}
Excerpt begins at section offset: ${args.excerptStartOffset}

<section-excerpt>
${args.excerpt}
</section-excerpt>`;
}

function splitAtBoundary(text: string, start: number, maximumBytes: number) {
  let end = Math.min(text.length, start + maximumBytes);
  while (
    end > start &&
    Buffer.byteLength(text.slice(start, end), "utf8") > maximumBytes
  ) {
    end--;
  }
  if (end === text.length) return end;

  const floor = start + Math.floor((end - start) * 0.6);
  const candidate = text.slice(floor, end);
  const boundary = Math.max(
    candidate.lastIndexOf("\n\n"),
    candidate.lastIndexOf("\n"),
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("; "),
  );
  return boundary >= 0 ? floor + boundary + 1 : end;
}

export function chunkSectionForAnalysis(
  section: BillSectionForAnalysis,
  inputTokenBudget = configuredInputTokenBudget(),
): SectionChunk[] {
  const emptyPrompt = buildSectionAnalysisPrompt({
    section,
    excerpt: "",
    excerptStartOffset: section.text.length,
  });
  const availableBytes =
    inputTokenBudget - conservativeTokenUpperBound(emptyPrompt);
  if (availableBytes < 256) {
    throw new Error(
      `BILL_ANALYSIS_INPUT_TOKEN_BUDGET=${inputTokenBudget} is too small for the analysis prompt`,
    );
  }

  const chunks: SectionChunk[] = [];
  let startOffset = 0;
  while (startOffset < section.text.length) {
    const endOffset = splitAtBoundary(
      section.text,
      startOffset,
      availableBytes,
    );
    const text = section.text.slice(startOffset, endOffset);
    const prompt = buildSectionAnalysisPrompt({
      section,
      excerpt: text,
      excerptStartOffset: startOffset,
    });
    if (conservativeTokenUpperBound(prompt) > inputTokenBudget) {
      throw new Error(
        "Section analysis prompt exceeded its input token budget",
      );
    }
    chunks.push({ text, startOffset });
    startOffset = endOffset;
  }
  return chunks;
}

function locateEvidence(
  evidence: z.infer<typeof GeneratedEvidenceSchema>,
  chunk: SectionChunk,
  sectionHash: string,
): BillSectionEvidence | null {
  let relativeStart = evidence.startOffset;
  let relativeEnd = evidence.endOffset;
  if (
    chunk.text.slice(relativeStart, relativeEnd) !== evidence.quote ||
    relativeEnd <= relativeStart
  ) {
    relativeStart = chunk.text.indexOf(evidence.quote);
    relativeEnd = relativeStart + evidence.quote.length;
  }
  if (relativeStart < 0 || relativeEnd > chunk.text.length) return null;
  return {
    quote: evidence.quote,
    sectionHash,
    startOffset: chunk.startOffset + relativeStart,
    endOffset: chunk.startOffset + relativeEnd,
  };
}

export function normalizeSectionNotes(
  generated: z.infer<typeof GeneratedNotesSchema>,
  chunk: SectionChunk,
  sectionHash: string,
): BillSectionNotes {
  return BillSectionNotesSchema.parse({
    summary: generated.summary,
    provisions: generated.provisions.flatMap((provision) => {
      const evidence = provision.evidence.flatMap((item) => {
        const located = locateEvidence(item, chunk, sectionHash);
        return located ? [located] : [];
      });
      return evidence.length > 0 ? [{ ...provision, evidence }] : [];
    }),
  });
}

/** Analyze one canonical bill section, chunking only within that section. */
export async function analyzeBillSection(
  section: BillSectionForAnalysis,
): Promise<BillSectionNotes> {
  try {
    const chunks = chunkSectionForAnalysis(section);
    const notes: BillSectionNotes[] = [];
    for (const chunk of chunks) {
      const { output, usage } = await generateText({
        model: getStructuredLlm(),
        output: Output.object({ schema: GeneratedNotesSchema }),
        maxOutputTokens: ANALYSIS_OUTPUT_TOKEN_BUDGET,
        prompt: buildSectionAnalysisPrompt({
          section,
          excerpt: chunk.text,
          excerptStartOffset: chunk.startOffset,
        }),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      notes.push(normalizeSectionNotes(output, chunk, section.sectionHash));
    }

    return BillSectionNotesSchema.parse({
      summary: notes.map((note) => note.summary).join(" "),
      provisions: notes.flatMap((note) => note.provisions),
    });
  } catch (error) {
    const rateLimited =
      (error instanceof APICallError && error.statusCode === 429) ||
      (error instanceof RetryError &&
        error.lastError instanceof APICallError &&
        error.lastError.statusCode === 429) ||
      (error instanceof Error &&
        /(?:429|rate limit|resource_exhausted|quota)/i.test(error.message));
    if (rateLimited) {
      setRateLimitHit(true);
      throw new AIRateLimitError();
    }
    throw error;
  }
}

export function formatSectionAnalysesForWriting(
  analyses: readonly {
    section: BillSectionForAnalysis;
    status: "analyzed" | "skipped" | "failed";
    notes: BillSectionNotes | null;
    error: string | null;
  }[],
): string {
  return analyses
    .map(({ section, status, notes, error }) => {
      const header = `## ${sectionLabel(section)}\nsectionHash: ${section.sectionHash}\ncoverage: ${status}`;
      if (!notes) return `${header}\n${error ? `reason: ${error}` : ""}`.trim();
      const provisions = notes.provisions
        .map(
          (provision) =>
            `- [${provision.kind}] ${provision.statement}\n  subjects: ${provision.subjects.join(", ") || "(none)"}\n${provision.evidence
              .map(
                (evidence) =>
                  `  evidence ${evidence.sectionHash}:${evidence.startOffset}-${evidence.endOffset}: ${JSON.stringify(evidence.quote)}`,
              )
              .join("\n")}`,
        )
        .join("\n");
      return `${header}\nsummary: ${notes.summary}\n${provisions}`.trim();
    })
    .join("\n\n");
}
