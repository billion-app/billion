import { z } from "zod";

/**
 * Bump when the section-note contract changes. Analysis is cached separately
 * from the reader-facing brief so editorial rewrites can reuse the expensive
 * read-through while a changed note schema forces a fresh analysis.
 */
export const BILL_ANALYSIS_VERSION = 1;

export const BillAnalysisFindingCategorySchema = z.enum([
  "change",
  "authority",
  "affected-party",
  "funding",
  "deadline",
  "effective-date",
  "enforcement",
  "penalty",
  "exemption",
  "definition",
  "cross-reference",
  "implementation",
  "oversight",
  "uncertainty",
]);
export type BillAnalysisFindingCategory = z.infer<
  typeof BillAnalysisFindingCategorySchema
>;

export const BillAnalysisQuoteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(20)
    .max(1600)
    .describe(
      "An exact, unedited span from this source section that supports the finding.",
    ),
  locator: z
    .string()
    .trim()
    .max(160)
    .optional()
    .describe("The most specific subsection or paragraph label available."),
});
export type BillAnalysisQuote = z.infer<typeof BillAnalysisQuoteSchema>;

export const BillAnalysisFindingSchema = z.object({
  category: BillAnalysisFindingCategorySchema,
  statement: z
    .string()
    .trim()
    .min(10)
    .max(600)
    .describe(
      "A precise, self-contained note describing the mechanism, condition, or unresolved point.",
    ),
  actors: z
    .array(z.string().trim().min(1).max(120))
    .max(8)
    .describe(
      "People, agencies, courts, governments, or organizations acting.",
    ),
  affectedParties: z
    .array(z.string().trim().min(1).max(140))
    .max(8)
    .describe("People or institutions directly affected by the provision."),
  crossReferences: z
    .array(z.string().trim().min(1).max(180))
    .max(8)
    .describe("Other statutes, sections, rules, or definitions referenced."),
  quote: BillAnalysisQuoteSchema.optional(),
});
export type BillAnalysisFinding = z.infer<typeof BillAnalysisFindingSchema>;

export const BillSectionNotesSchema = z.object({
  sectionId: z.string().trim().min(1).max(120),
  locator: z.string().trim().min(1).max(180),
  summary: z
    .string()
    .trim()
    .min(10)
    .max(900)
    .describe(
      "A compact inventory of what this section does, without editorial framing.",
    ),
  substantive: z
    .boolean()
    .describe(
      "False only for tables of contents, boilerplate, or other text with no operative or interpretive content.",
    ),
  findings: z
    .array(BillAnalysisFindingSchema)
    .max(30)
    .describe(
      "Specific and exhaustive notes for every material mechanism in the section.",
    ),
});
export type BillSectionNotes = z.infer<typeof BillSectionNotesSchema>;

export const BillAnalysisSchema = z.object({
  sourceLength: z.number().int().nonnegative(),
  sourceHash: z.string().length(64),
  sectionCount: z.number().int().positive(),
  analyzedSectionIds: z.array(z.string().trim().min(1).max(120)).min(1),
  sections: z.array(BillSectionNotesSchema).min(1),
});
export type BillAnalysis = z.infer<typeof BillAnalysisSchema>;

export const BillAnalysisRecordSchema = BillAnalysisSchema.extend({
  version: z.literal(BILL_ANALYSIS_VERSION),
  generatedAt: z.string(),
  modelVersion: z.string(),
});
export type BillAnalysisRecord = z.infer<typeof BillAnalysisRecordSchema>;
