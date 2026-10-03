import { z } from "zod/v4";

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
          url: z.url().refine((url) => /^https?:\/\//.test(url)),
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
