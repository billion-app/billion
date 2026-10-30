import { z } from "zod/v4";

import type { CandidateBrief } from "@acme/validators";
import {
  candidateBriefSchema,
  candidateModelAttestationSchema,
  candidateResearchQualitySchema,
} from "@acme/validators";

import { briefDigest } from "./candidate-brief-publication";

export const researchAutomationPolicySchema = z.object({
  serviceActorId: z.string().trim().min(1),
  allowedAuthorModels: z.array(z.string().min(1)).min(1),
  allowedReviewerModels: z.array(z.string().min(1)).min(1),
  researchVersion: z.string().min(1),
});
export type ResearchAutomationPolicy = z.infer<
  typeof researchAutomationPolicySchema
>;
export const researchReviewAttestationSchema = z.object({
  collectionId: z.uuid().optional(),
  // Derived by the trusted service after validating the immutable dossier.
  quality: candidateResearchQualitySchema.optional(),
  author: candidateModelAttestationSchema,
  reviewer: candidateModelAttestationSchema,
  verdict: z.enum(["approve", "reject"]),
  findings: z.array(
    z.object({
      claimId: z.string().min(1),
      supported: z.boolean(),
      reason: z.string().min(1),
    }),
  ),
});
export type ResearchReviewAttestation = z.infer<
  typeof researchReviewAttestationSchema
>;

export function validResearchAttestation(input: {
  value: unknown;
  brief: CandidateBrief;
  policyVersion: string;
  automation: ResearchAutomationPolicy;
  dossier: {
    dossierDigest: string;
    sourceSetDigest: string;
    authorRunId: string;
    quality?: z.infer<typeof candidateResearchQualitySchema>;
  };
  now: string;
}): boolean {
  const parsedBrief = candidateBriefSchema.safeParse(input.brief);
  if (!parsedBrief.success) return false;
  const parsed = researchReviewAttestationSchema.safeParse(input.value);
  if (!parsed.success) return false;
  const { author, reviewer, verdict, findings, quality } = parsed.data;
  const expectedQuality = candidateResearchQualitySchema.safeParse(
    input.dossier.quality,
  );
  if (
    !quality ||
    !expectedQuality.success ||
    JSON.stringify(quality) !== JSON.stringify(expectedQuality.data)
  )
    return false;
  const claims = input.brief.sections.flatMap((section) => section.claims);
  if (
    quality.evidenceIds.some(
      (id) => !input.brief.evidence.some((e) => e.id === id),
    ) ||
    quality.claimIds.some(
      (id) =>
        !claims.some(
          (claim) =>
            claim.id === id &&
            claim.evidenceIds.some((e) => quality.evidenceIds.includes(e)),
        ) ||
        !findings.some(
          (finding) => finding.claimId === id && finding.supported,
        ),
    )
  )
    return false;
  if (quality.basis !== "reconciled_finance") {
    const topic =
      quality.basis === "candidate_record" ? "record" : "priorities";
    const section = input.brief.sections.find((entry) => entry.topic === topic);
    if (
      !quality.claimIds.length ||
      !quality.evidenceIds.length ||
      quality.claimIds.some(
        (id) => !section?.claims.some((claim) => claim.id === id),
      )
    )
      return false;
  } else if (!input.brief.research?.finance || !quality.evidenceIds.length)
    return false;
  const now = Date.parse(input.now);
  const revisionDigest = briefDigest(input.brief);
  if (
    input.brief.authorship.kind !== "generated" ||
    input.brief.authorship.model !== author.actualModel ||
    input.brief.authorship.promptVersion !== author.promptVersion ||
    verdict !== "approve" ||
    findings.some((f) => !f.supported) ||
    author.role !== "author" ||
    reviewer.role !== "reviewer" ||
    author.actorId !== input.brief.authorId ||
    author.actorId === reviewer.actorId ||
    author.runId === reviewer.runId ||
    author.runId !== input.dossier.authorRunId ||
    !input.automation.allowedAuthorModels.includes(author.actualModel) ||
    !input.automation.allowedReviewerModels.includes(reviewer.actualModel)
  )
    return false;
  for (const run of [author, reviewer]) {
    if (
      run.policyVersion !== input.policyVersion ||
      run.revisionDigest !== revisionDigest ||
      run.dossierDigest !== input.dossier.dossierDigest ||
      run.sourceSetDigest !== input.dossier.sourceSetDigest ||
      Date.parse(run.startedAt) > Date.parse(run.completedAt) ||
      Date.parse(run.completedAt) > now
    )
      return false;
  }
  if (Date.parse(reviewer.startedAt) < Date.parse(author.completedAt))
    return false;
  const claimIds = input.brief.sections.flatMap((s) =>
    s.claims.map((c) => c.id),
  );
  return claimIds.every((id) =>
    findings.some((f) => f.claimId === id && f.supported),
  );
}
