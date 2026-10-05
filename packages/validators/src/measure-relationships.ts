import { z } from "zod/v4";

const text = z.string().trim().min(1).max(2000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const claim = z.object({ text, sourceIds: z.array(z.string()).min(1) });
export const measureRelationshipSchema = z.object({
  schemaVersion: z.literal(1),
  revision: text,
  jurisdiction: z.literal("CA"),
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["conflict", "precedence", "dependency", "uncertain"]),
  measures: z.tuple([
    z.object({ number: text, title: text, url: z.url(), guideHash: hash }),
    z.object({ number: text, title: text, url: z.url(), guideHash: hash }),
  ]),
  sources: z
    .array(
      z.object({
        id: text,
        number: text,
        role: z.enum(["legal-text", "official-analysis"]),
        url: z.url(),
        locator: text,
        retrievedAt: z.iso.datetime(),
        snapshot: z.string().min(1).max(200000),
        hash,
        documentHash: hash,
      }),
    )
    .min(4)
    .max(20),
  takeaway: claim,
  affectedProvisions: z.array(claim).min(1),
  scenarios: z.object({
    neither: claim,
    onlyFirst: claim,
    onlySecond: claim,
    both: claim,
  }),
  conditions: z.array(claim).min(1),
  review: z.object({
    state: z.enum(["pending", "approved", "rejected"]),
    reviewer: text.optional(),
    reviewedAt: z.iso.datetime().optional(),
    revision: text.optional(),
    evidenceHash: hash.optional(),
    findings: text.optional(),
  }),
});
export type MeasureRelationship = z.infer<typeof measureRelationshipSchema>;
export type PublicMeasureRelationship = Omit<MeasureRelationship, "sources"> & {
  sources: Omit<MeasureRelationship["sources"][number], "snapshot">[];
};
