import { z } from "zod/v4";

import type { CandidateRaceManifest } from "./candidate-research";
import { candidateResearchSchema } from "./candidate-research";

const text = z.string().trim().min(1).max(4000);
const date = z.iso.datetime();
export const candidateBriefIdentitySchema = z.object({
  candidateId: text,
  contestId: text,
  electionDate: z.iso.date(),
  jurisdiction: text,
});
export const candidateBriefSchema = z
  .object({
    schemaVersion: z.literal(1),
    identity: candidateBriefIdentitySchema,
    revisionId: z.uuid(),
    supersedes: z.uuid().nullable(),
    createdAt: date,
    authorId: text,
    authorship: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("human") }),
      z.object({
        kind: z.literal("generated"),
        model: text,
        promptVersion: text,
      }),
    ]),
    evidence: z
      .array(
        z.object({
          id: text,
          title: text.optional(),
          shows: text.optional(),
          limits: text.optional(),
          url: z.url().refine((url) => /^https?:\/\//.test(url)),
          filingUrl: z
            .url()
            .refine((url) => /^https?:\/\//.test(url))
            .optional(),
          publisher: text,
          locator: text,
          retrievedAt: date,
          documentDate: z.iso.date().nullable(),
          contentHash: z.string().regex(/^[a-f0-9]{64}$/),
          excerpt: text,
          origin: z.enum(["candidate", "primary_record", "reporting"]),
        }),
      )
      .max(100),
    research: candidateResearchSchema.optional(),
    sections: z
      .array(
        z.object({
          topic: z.enum([
            "priorities",
            "record",
            "mechanisms",
            "effects",
            "tradeoffs",
            "unknowns",
          ]),
          missingEvidence: text.nullable(),
          claims: z
            .array(
              z.object({
                id: text,
                kind: z.enum(["promise", "fact", "disputed", "analysis"]),
                text,
                emphasis: z.array(text).max(4).optional(),
                evidenceIds: z.array(text).min(1),
              }),
            )
            .max(30),
        }),
      )
      .length(6),
    correction: z
      .object({ reason: text, previousRevisionId: z.uuid() })
      .nullable(),
  })
  .superRefine((brief, ctx) => {
    const topics = brief.sections.map((s) => s.topic);
    if (new Set(topics).size !== 6)
      ctx.addIssue({
        code: "custom",
        message: "Each topic must occur exactly once",
      });
    const evidence = new Map(brief.evidence.map((e) => [e.id, e]));
    if (evidence.size !== brief.evidence.length)
      ctx.addIssue({ code: "custom", message: "Duplicate evidence IDs" });
    const ids = new Set<string>();
    for (const section of brief.sections) {
      if (!section.claims.length && !section.missingEvidence)
        ctx.addIssue({
          code: "custom",
          message: "Empty section needs an explicit evidence gap",
        });
      for (const claim of section.claims) {
        if (claim.emphasis?.some((phrase) => !claim.text.includes(phrase)))
          ctx.addIssue({
            code: "custom",
            message: "Claim emphasis must quote its text",
          });
        if (ids.has(claim.id))
          ctx.addIssue({ code: "custom", message: "Duplicate claim IDs" });
        ids.add(claim.id);
        if (claim.evidenceIds.some((id) => !evidence.has(id)))
          ctx.addIssue({
            code: "custom",
            message: "Unknown evidence reference",
          });
        if (
          claim.kind === "fact" &&
          !claim.evidenceIds.some(
            (id) => evidence.get(id)?.origin === "primary_record",
          )
        )
          ctx.addIssue({
            code: "custom",
            message: "Documented facts require a primary record",
          });
      }
    }
    if (brief.research) {
      const claims = brief.sections.flatMap((section) => section.claims);
      if (!claims.some((claim) => claim.id === brief.research?.headlineClaimId))
        ctx.addIssue({ code: "custom", message: "Unknown headline claim" });
      const promises = new Set<string>();
      for (const promise of brief.research.promises) {
        if (
          promises.has(promise.claimId) ||
          !claims.some(
            (claim) => claim.id === promise.claimId && claim.kind === "promise",
          )
        )
          ctx.addIssue({
            code: "custom",
            message: "Promise details require a unique campaign promise",
          });
        promises.add(promise.claimId);
      }
      // Walk the structured reading fields so every source-bearing point is checked.
      function checkReferences(value: unknown): void {
        if (!value || typeof value !== "object") return;
        for (const [key, item] of Object.entries(value)) {
          if (
            (key === "evidenceIds" || key === "filingEvidenceIds") &&
            Array.isArray(item)
          ) {
            if (item.some((id) => typeof id !== "string" || !evidence.has(id)))
              ctx.addIssue({
                code: "custom",
                message: "Unknown research evidence reference",
              });
          } else if (Array.isArray(item)) item.forEach(checkReferences);
          else checkReferences(item);
        }
      }
      checkReferences(brief.research);
      const finance = brief.research.finance;
      if (finance) {
        const financialRefs = [
          ...finance.filingEvidenceIds,
          ...finance.donors.flatMap((d) => d.evidenceIds),
          ...(finance.outsideSpending?.flatMap((d) => d.evidenceIds) ?? []),
        ];
        if (
          financialRefs.some(
            (id) => evidence.get(id)?.origin !== "primary_record",
          )
        )
          ctx.addIssue({
            code: "custom",
            message: "Financial amounts require primary records",
          });
      }
    }
    if (
      brief.correction &&
      brief.correction.previousRevisionId !== brief.supersedes
    )
      ctx.addIssue({
        code: "custom",
        message: "Correction must identify the superseded revision",
      });
  });
export type CandidateBrief = z.infer<typeof candidateBriefSchema>;
export type CandidateBriefIdentity = z.infer<
  typeof candidateBriefIdentitySchema
>;

export interface CandidateResearchRace {
  manifest: CandidateRaceManifest;
  briefs: CandidateBrief[];
  reviewedAt: string;
}
