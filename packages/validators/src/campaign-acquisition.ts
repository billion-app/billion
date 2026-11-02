import { z } from "zod/v4";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const campaignAcquisitionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("rendered_campaign_v1"),
      archiveSourceId: z.string().min(1).max(200),
      pageIndex: z.number().int().min(0).max(2),
      semanticDigest: digest,
    })
    .strict(),
  z
    .object({
      kind: z.literal("campaign_render_archive_v1"),
      semanticDigest: digest,
    })
    .strict(),
]);
export const campaignOwnershipProofSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("current_sos_campaign_v1"),
      contactSourceId: z.string().min(1).max(200),
      contactExcerpt: z.string().min(1).max(4000),
      listedUrl: z.url(),
      destinationSourceId: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("qualified_party_campaign_v1"),
      currentContactSourceId: z.string().min(1).max(200),
      contactExcerpt: z.string().min(1).max(4000),
      registrySourceId: z.string().min(1).max(200),
      partyListSourceId: z.string().min(1).max(200),
      partyName: z.literal("Democratic Party"),
      partyWebsiteAnchor: z.literal("http://www.cadem.org/"),
      candidateAnchor: z.string().min(1).max(200),
      listedUrl: z.url(),
      destinationSourceId: z.string().min(1).max(200),
      legalOwner: z.string().min(1).max(200),
    })
    .strict(),
]);
export type CampaignOwnershipProof = z.infer<
  typeof campaignOwnershipProofSchema
>;

export const campaignBrowserContract = {
  protocol: "campaign-browser-network-none-v1",
  playwrightVersion: "1.58.2",
  image:
    "mcr.microsoft.com/playwright@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d",
  seccompHash:
    "428a062dfcc138999687d9922b61a8bc5cf0bce198198e4cf45c5e9b0289cb52",
} as const;
