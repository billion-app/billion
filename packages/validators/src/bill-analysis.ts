import { z } from "zod/v4";

export const BILL_ANALYSIS_SCHEMA_VERSION = "bill-section-notes-v1";

export const BillAnalysisStatusSchema = z.enum([
  "analyzed",
  "skipped",
  "failed",
]);
export type BillAnalysisStatus = z.infer<typeof BillAnalysisStatusSchema>;

export const BillSectionEvidenceSchema = z.object({
  quote: z.string().trim().min(1),
  /** SHA-256 of the exact section analysis unit that contains this quote. */
  sectionHash: z.string().length(64),
  /** Zero-based offsets within the section analysis unit, end-exclusive. */
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().positive(),
});
export type BillSectionEvidence = z.infer<typeof BillSectionEvidenceSchema>;

export const BillSectionProvisionSchema = z.object({
  kind: z.enum([
    "change",
    "binding",
    "effective_date",
    "penalty",
    "exemption",
    "definition",
    "cross_reference",
    "funding",
    "oversight",
    "other",
  ]),
  statement: z.string().trim().min(1).max(800),
  subjects: z.array(z.string().trim().min(1).max(120)).max(12),
  evidence: z.array(BillSectionEvidenceSchema).min(1).max(6),
});
export type BillSectionProvision = z.infer<typeof BillSectionProvisionSchema>;

export const BillSectionNotesSchema = z.object({
  summary: z.string().trim().min(1).max(100_000),
  provisions: z.array(BillSectionProvisionSchema).max(2_000),
});
export type BillSectionNotes = z.infer<typeof BillSectionNotesSchema>;

export const BillSectionAnalysisRecordSchema = z.object({
  ordinal: z.number().int().min(0),
  heading: z.string().trim().min(1),
  sectionHash: z.string().length(64),
  documentStartOffset: z.number().int().min(0),
  documentEndOffset: z.number().int().positive(),
  status: BillAnalysisStatusSchema,
  notes: BillSectionNotesSchema.nullable(),
  error: z.string().nullable(),
});
export type BillSectionAnalysisRecord = z.infer<
  typeof BillSectionAnalysisRecordSchema
>;
