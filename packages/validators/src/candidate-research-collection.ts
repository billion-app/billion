import { z } from "zod/v4";

import { candidateBriefSchema } from "./candidate-brief";
import { candidateRaceManifestSchema } from "./candidate-research";

export const candidateResearchTemplateVersion = "ca-house-17-v3";

/** Collected source text stays separate from the editable, unpublished explanation. */
export const researchSourceSchema = z.object({
  id: z.string().min(1),
  url: z.url(),
  publisher: z.string().min(1),
  format: z.enum(["html", "pdf", "json", "text"]),
  text: z.string().min(1).max(5_000_000),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  fetchedAt: z.iso.datetime(),
});
export const candidateResearchCollectionSchema = z
  .object({
    pilotKey: z.string().min(1).max(100),
    manifest: candidateRaceManifestSchema,
    briefs: z.array(candidateBriefSchema).min(1).max(100),
    sources: z.array(researchSourceSchema).min(1).max(200),
    problems: z.array(z.string().max(1000)).max(100),
  })
  .superRefine((collection, ctx) => {
    const members = collection.manifest.members;
    if (
      members.length !== collection.briefs.length ||
      members.some(
        (m) =>
          !collection.briefs.some(
            (b) =>
              b.revisionId === m.revisionId &&
              b.identity.candidateId === m.candidateId &&
              b.identity.contestId === collection.manifest.contestId &&
              b.identity.jurisdiction === collection.manifest.jurisdiction &&
              b.identity.electionDate === collection.manifest.electionDate,
          ),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Collection must contain the exact full roster",
      });
    if (
      !collection.sources.some(
        (source) =>
          source.url === collection.manifest.rosterSourceUrl &&
          source.contentHash === collection.manifest.rosterHash,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Official roster must reference a collected source snapshot",
      });
    const sources = new Map(collection.sources.map((s) => [s.id, s]));
    if (sources.size !== collection.sources.length)
      ctx.addIssue({ code: "custom", message: "Duplicate source IDs" });
    for (const brief of collection.briefs)
      for (const evidence of brief.evidence) {
        if (
          !collection.sources.some(
            (s) =>
              s.contentHash === evidence.contentHash &&
              s.url === evidence.url &&
              (!evidence.filingUrl || s.text.includes(evidence.filingUrl)) &&
              s.text.includes(evidence.excerpt),
          )
        )
          ctx.addIssue({
            code: "custom",
            message: `Evidence ${evidence.id} must quote a collected source with the same hash`,
          });
      }
  });
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type CandidateResearchCollectionDocument = z.infer<
  typeof candidateResearchCollectionSchema
>;
