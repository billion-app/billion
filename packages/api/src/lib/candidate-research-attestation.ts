import { z } from "zod/v4";

import type { CandidateBrief } from "@acme/validators";
import {
  candidateBriefSchema,
  candidateModelAttestationSchema,
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
  };
  now: string;
}): boolean {
  const parsedBrief = candidateBriefSchema.safeParse(input.brief);
  if (!parsedBrief.success) return false;
  const parsed = researchReviewAttestationSchema.safeParse(input.value);
  if (!parsed.success) return false;
  const { author, reviewer, verdict, findings } = parsed.data;
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
