import { z } from "zod/v4";

import {
  contextMoneyMentions,
  contextMoneySchema,
  hasUncoveredContextMoney,
} from "./budget-context";

const id = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(100);
const short = z.string().trim().min(1).max(500);
const presentation = short.refine(
  (text) => contextMoneyMentions(text).length === 0,
  "Put monetary amounts in typed claims, not headings or citation labels.",
);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const https = z.url().refine((value) => {
  return /^https:\/\/[^/@\s]+(?:\/|$)/.test(value);
});
export const contextSourceSchema = z.object({
  id,
  name: presentation,
  url: https,
  layer: z.enum([
    "legal-text",
    "official-summary",
    "official-analysis",
    "submitted-advocacy",
    "independent-research",
    "official-record",
  ]),
  retrievedAt: z.iso.datetime(),
  snapshot: z.string().min(1).max(100_000),
});
const citation = z.object({ sourceId: id, locator: presentation });
export const contextClaimSchema = z
  .object({
    text: short,
    kind: z.enum([
      "source-summary",
      "billion-inference",
      "illustration",
      "unknown",
    ]),
    evidence: z.array(citation).min(1).max(8),
    money: z.array(contextMoneySchema).min(1).max(8).optional(),
  })
  .superRefine((value, ctx) => {
    if (hasUncoveredContextMoney(value.text, value.money ?? []))
      ctx.addIssue({
        code: "custom",
        message:
          "Every explicit money mention requires nominal value and budget-share context.",
      });
  });
const claim = contextClaimSchema;
/** Source-captured, immutable editorial record; no generation happens on reads. */
export const propositionContextSchema = z.object({
  schemaVersion: z.literal(1),
  revision: id,
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  number: z.string().regex(/^\d+[A-Z]?$/),
  officialTitle: z.string().min(1).max(2000),
  officialUrl: https,
  guideHash: hash,
  preparedAt: z.iso.datetime(),
  authorship: z.enum(["ai-assisted", "human-authored"]),
  sources: z.array(contextSourceSchema).min(2).max(20),
  takeaway: claim,
  today: claim,
  change: claim,
  rationale: claim,
  terms: z.array(z.object({ term: presentation, meaning: claim })).max(6),
  mechanismQuestion: presentation,
  chain: z
    .array(z.object({ actor: presentation, action: claim }))
    .min(2)
    .max(6),
  tradeoffs: z.array(claim).min(1).max(5),
  unknowns: z
    .array(
      z.object({
        status: z.enum([
          "not-specified",
          "later-legislation",
          "evidence-unavailable",
          "uncertain-effect",
        ]),
        claim,
      }),
    )
    .min(1)
    .max(6),
  magnitude: z
    .array(
      z.object({
        amount: claim,
        comparison: claim,
        period: presentation,
        basis: z.enum(["projection", "measured", "illustrative"]),
      }),
    )
    .max(3),
  history: z
    .array(
      z.object({
        date: presentation,
        finding: claim,
        followThrough: claim,
        outcome: claim,
        limit: claim,
      }),
    )
    .max(3),
  scenarios: z.array(z.object({ title: presentation, claim })).max(4),
  questions: z
    .array(z.object({ question: presentation, path: claim }))
    .min(1)
    .max(5),
  review: z.discriminatedUnion("state", [
    z.object({ state: z.literal("pending") }),
    z.object({ state: z.literal("rejected"), reason: short }),
    z.object({
      state: z.literal("approved"),
      reviewer: short,
      reviewedAt: z.iso.datetime(),
      revision: id,
      contentHash: hash,
      findings: short,
    }),
  ]),
});
export type PropositionContext = z.infer<typeof propositionContextSchema>;
export type ContextClaim = z.infer<typeof contextClaimSchema>;
export const publicPropositionContextSchema = propositionContextSchema
  .omit({ sources: true })
  .extend({
    sources: z
      .array(contextSourceSchema.omit({ snapshot: true }))
      .min(2)
      .max(20),
  });
export type PublicPropositionContext = z.infer<
  typeof publicPropositionContextSchema
>;
