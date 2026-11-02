import { z } from "zod/v4";

import { campaignAcquisitionSchema } from "./campaign-acquisition";
import { candidateBriefSchema } from "./candidate-brief";
import { candidateRaceManifestSchema } from "./candidate-research";

export const candidateResearchTemplateVersion = "ca-house-17-v4";

/** Collected source text stays separate from the editable, unpublished explanation. */
export const researchSourceSchema = z
  .object({
    id: z.string().min(1),
    url: z.url(),
    publisher: z.string().min(1),
    format: z.enum(["html", "pdf", "json", "text", "image", "render_archive"]),
    acquisition: campaignAcquisitionSchema.optional(),
    httpObservation: z
      .object({
        kind: z.literal("campaign_http_document_v1"),
        responses: z
          .array(
            z
              .object({
                url: z.url(),
                status: z.number().int().min(200).max(399),
                mime: z.string().max(200),
                location: z.string().max(4000).nullable(),
                bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
                bodyBytes: z.number().int().min(0).max(1_000_000),
                startedAt: z.iso.datetime(),
                completedAt: z.iso.datetime(),
                bodyBase64: z.string().max(65_536).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(4),
      })
      .strict()
      .optional(),
    text: z.string().max(5_000_000),
    binaryBase64: z
      .string()
      .max(6_666_668)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
      .optional(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    byteHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    fetchedAt: z.iso.datetime(),
    retrievalUrls: z.array(z.url()).min(1).max(4).optional(),
  })
  .superRefine((source, context) => {
    if (source.format === "render_archive") {
      if (
        source.acquisition?.kind !== "campaign_render_archive_v1" ||
        !source.binaryBase64 ||
        !source.byteHash
      )
        context.addIssue({
          code: "custom",
          message:
            "Rendered archives require their typed compressed bytes and hash",
        });
    } else if (source.acquisition?.kind === "campaign_render_archive_v1")
      context.addIssue({
        code: "custom",
        message: "Rendered archive cannot masquerade as HTTP evidence",
      });
    if (
      source.acquisition?.kind === "rendered_campaign_v1" &&
      (source.format !== "html" || !source.byteHash || source.binaryBase64)
    )
      context.addIssue({
        code: "custom",
        message:
          "Rendered campaign page must reference its separate immutable archive",
      });
    if (source.format === "image") {
      if (source.text !== "" || !source.byteHash || !source.binaryBase64)
        context.addIssue({
          code: "custom",
          message:
            "Image sources require empty text, actual binary archive and raw byte hash",
        });
    } else if (source.text.length === 0)
      context.addIssue({
        code: "custom",
        message: "Textual sources require original text",
      });
  });
export const candidateResearchCollectionSchema = z
  .object({
    pilotKey: z.string().min(1).max(200),
    candidateArtifacts: z
      .array(
        z.object({
          candidateId: z.string().min(1),
          dossierDigest: z.string().regex(/^[a-f0-9]{64}$/),
          sourceSetDigest: z.string().regex(/^[a-f0-9]{64}$/),
          author: z.unknown(),
          dossier: z.unknown().optional(),
        }),
      )
      .max(100)
      .optional(),
    researchVersion: z.string().min(1).max(100).optional(),
    rosterSnapshotId: z.string().min(1).max(100).optional(),
    rosterDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
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
