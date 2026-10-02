import { z } from "zod/v4";

const text = z.string().trim().min(1).max(2000);
const id = z.string().regex(/^[a-z0-9-]+$/);
const claim = z.object({
  text,
  sourceIds: z.array(id).min(1).max(10),
});

/** A revision is immutable. Approval applies to this revision and source snapshot. */
export const propositionConsequencesSchema = z.object({
  schemaVersion: z.literal(1),
  revision: id,
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  number: z.string().regex(/^\d+[A-Z]?$/),
  officialTitle: text,
  officialUrl: z.url(),
  guideHash: z.string().regex(/^[a-f0-9]{64}$/),
  templateVersion: z.literal("consequences-v1"),
  generatedAt: z.iso.datetime(),
  model: text,
  sources: z
    .array(
      z.object({
        id,
        name: text,
        url: z.url().refine((url) => url.startsWith("https://")),
        retrievedAt: z.iso.datetime(),
        snapshot: z.string().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(20),
  headline: claim,
  currentRule: claim,
  yes: claim,
  no: claim,
  implementation: z.array(claim).min(1).max(8),
  affected: z.array(claim).min(1).max(8),
  costsAndFunding: claim,
  uncertainty: claim,
  review: z.discriminatedUnion("state", [
    z.object({ state: z.literal("pending") }),
    z.object({
      state: z.literal("rejected"),
      reviewer: text,
      reviewedAt: z.iso.datetime(),
      reason: text,
    }),
    z.object({
      state: z.literal("approved"),
      reviewer: text,
      reviewedAt: z.iso.datetime(),
      revision: id,
      guideHash: z.string().regex(/^[a-f0-9]{64}$/),
      findings: text,
    }),
  ]),
});
export type PropositionConsequences = z.infer<
  typeof propositionConsequencesSchema
>;
