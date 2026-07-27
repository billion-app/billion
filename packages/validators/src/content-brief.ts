import { z } from "zod";

import {
  BillBriefRecordSchema,
  BriefFactSchema,
  BriefQuoteSchema,
  BriefTermSchema,
  parseBillBriefRecord,
} from "./bill-brief";

export const COURT_CASE_BRIEF_VERSION = 1;

export const NarrativeBriefItemSchema = z.object({
  text: z
    .string()
    .trim()
    .min(20)
    .max(360)
    .describe(
      "A complete plain-language sentence or short paragraph. Mark one or two concrete phrases with **double asterisks**.",
    ),
  quote: BriefQuoteSchema.optional().describe(
    "An exact supporting passage from the official source.",
  ),
});
export type NarrativeBriefItem = z.infer<typeof NarrativeBriefItemSchema>;

export const NarrativeBriefSectionSchema = z.object({
  title: z.string().trim().min(4).max(64),
  items: z.array(NarrativeBriefItemSchema).min(1).max(4),
});
export type NarrativeBriefSection = z.infer<typeof NarrativeBriefSectionSchema>;

export const CourtCaseBriefSchema = z.object({
  badge: z.string().trim().min(3).max(24),
  hook: z
    .string()
    .trim()
    .min(60)
    .max(420)
    .describe(
      "A coherent 2–3 sentence explanation of the case's practical importance. Preserve pending-versus-decided status and bold two or three short key phrases.",
    ),
  facts: z.array(BriefFactSchema).max(4),
  sections: z.array(NarrativeBriefSectionSchema).min(2).max(5),
  terms: z.array(BriefTermSchema).max(5),
  unknowns: z
    .array(
      z
        .string()
        .trim()
        .min(20)
        .max(240)
        .describe(
          "A complete sentence explaining something the record or pending case does not settle. Bold one short key phrase.",
        ),
    )
    .max(3),
});
export type CourtCaseBrief = z.infer<typeof CourtCaseBriefSchema>;

export const CourtCaseBriefRecordSchema = CourtCaseBriefSchema.extend({
  kind: z.literal("court_case"),
  presentation: z.literal("court_case"),
  version: z.literal(COURT_CASE_BRIEF_VERSION),
  verifiedQuotes: z.number().int().min(0),
  generatedAt: z.string(),
  modelVersion: z.string(),
});
export type CourtCaseBriefRecord = z.infer<typeof CourtCaseBriefRecordSchema>;

export const StoredContentBriefRecordSchema = z.union([
  BillBriefRecordSchema,
  CourtCaseBriefRecordSchema,
]);
export type StoredContentBriefRecord = z.infer<
  typeof StoredContentBriefRecordSchema
>;

export type ContentBriefRecord =
  | ({ kind: "bill" } & z.infer<typeof BillBriefRecordSchema>)
  | CourtCaseBriefRecord;

export function parseContentBriefRecord(
  value: unknown,
): ContentBriefRecord | null {
  const bill = parseBillBriefRecord(value);
  if (bill) return { kind: "bill", ...bill };

  const courtCase = CourtCaseBriefRecordSchema.safeParse(value);
  return courtCase.success ? courtCase.data : null;
}

export function isCurrentCourtCaseBrief(value: unknown): boolean {
  return CourtCaseBriefRecordSchema.safeParse(value).success;
}
