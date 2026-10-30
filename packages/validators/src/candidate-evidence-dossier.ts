import { z } from "zod/v4";

import { candidateBriefIdentitySchema } from "./candidate-brief";
import { campaignFinanceSchema } from "./candidate-research";
import { researchSourceSchema } from "./candidate-research-collection";

const text = z.string().trim().min(1).max(4000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const campaignContactProofSchema = z.object({
  kind: z.literal("historical_official_filing"),
  identity: candidateBriefIdentitySchema,
  websiteUrl: z.url(),
  destinationSourceId: text,
  retrievalUrls: z.array(z.url()).min(1).max(4),
  officialSource: z.object({
    url: z.url(),
    contentHash: digest,
    fetchedAt: z.iso.datetime(),
    locator: text,
    excerpt: text,
    recordDigest: digest,
    officialRecordName: text,
  }),
});
export type CampaignContactProof = z.infer<typeof campaignContactProofSchema>;
export function canonicalCampaignContactUrl(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    /^[\d.]+$/.test(url.hostname) ||
    url.hostname.startsWith("[") ||
    /(^|\.)localhost$|\.local$|\.internal$/.test(
      url.hostname.replace(/\.$/, ""),
    ) ||
    /\s/.test(value)
  )
    throw new Error("Campaign contact requires a public HTTP website");
  url.hash = "";
  return url.toString();
}
export const candidateEvidenceDossierSchema = z.object({
  schemaVersion: z.literal(1),
  identity: candidateBriefIdentitySchema,
  name: text,
  officeFamily: text,
  officeKind: z.enum([
    "federal_legislative",
    "state_legislative",
    "state_executive",
    "state_board",
    "judicial_retention",
    "judicial_election",
    "local",
  ]),
  rosterDigest: digest,
  researchVersion: text,
  createdAt: z.iso.datetime(),
  finance: campaignFinanceSchema.nullable().optional(),
  campaignContactProof: campaignContactProofSchema.optional(),
  financeIdentityProof: z
    .object({
      candidateId: z.string().regex(/^H[A-Z0-9]{8}$/),
      name: text,
      office: z.literal("H"),
      state: z.literal("CA"),
      district: z.string().regex(/^\d{1,2}$/),
      cycle: z.number().int(),
      sourceId: text,
      sourceHash: digest,
    })
    .optional(),
  sources: z.array(researchSourceSchema).min(1).max(40),
  sourceLinks: z
    .array(
      z.object({
        fromSourceId: text,
        toSourceId: text,
        url: z.url(),
        anchorText: text,
        relation: z.enum(["official_contact", "same_origin_campaign"]),
      }),
    )
    .max(20)
    .optional(),
  evidence: z
    .array(
      z.object({
        id: text,
        sourceId: text,
        excerpt: text,
        locator: text,
        origin: z.enum(["candidate", "primary_record", "reporting"]),
        role: z.enum([
          "roster",
          "office_authority",
          "candidate_statement",
          "candidate_record",
          "finance",
        ]),
        identityQualification: z.enum([
          "official_roster",
          "official_cross_link",
          "exact_election_office",
        ]),
      }),
    )
    .min(1)
    .max(100),
  gaps: z
    .array(
      z.object({
        dimension: z.enum([
          "priorities",
          "record",
          "mechanisms",
          "effects",
          "tradeoffs",
          "unknowns",
          "finance",
        ]),
        code: z.enum([
          "not_found_in_checked_sources",
          "not_applicable",
          "identity_unresolved",
          "source_unavailable",
        ]),
        message: text,
        checkedSourceIds: z.array(text).max(40),
        required: z.boolean(),
      }),
    )
    .max(40),
  classification: z.enum(["supported", "evidence_gap"]),
  sourceSetDigest: digest,
  dossierDigest: digest,
});
export type CandidateEvidenceDossier = z.infer<
  typeof candidateEvidenceDossierSchema
>;

export function validateCampaignContactDestination(
  dossier: CandidateEvidenceDossier,
): void {
  const proof = dossier.campaignContactProof;
  if (!proof) return;
  if (
    dossier.officeFamily !== "local" ||
    Date.parse(proof.officialSource.fetchedAt) > Date.parse(dossier.createdAt)
  )
    throw new Error(
      "Historical contact proof must belong to a local candidate and retain its original past observation time",
    );
  if (
    ["candidateId", "contestId", "jurisdiction", "electionDate"].some(
      (key) =>
        proof.identity[key as keyof typeof proof.identity] !==
        dossier.identity[key as keyof typeof dossier.identity],
    )
  )
    throw new Error(
      "Campaign contact proof belongs to a different candidate identity",
    );
  if (dossier.sources.some((source) => source.url === proof.officialSource.url))
    throw new Error(
      "Historical contact filings are discovery metadata and cannot be dossier sources or citation evidence",
    );
  const destination = dossier.sources.find(
    (source) => source.id === proof.destinationSourceId,
  );
  if (
    !destination ||
    !destination.retrievalUrls ||
    destination.retrievalUrls.length !== proof.retrievalUrls.length ||
    proof.retrievalUrls.some(
      (url, index) =>
        canonicalCampaignContactUrl(url) !==
        canonicalCampaignContactUrl(destination.retrievalUrls?.[index] ?? ""),
    ) ||
    canonicalCampaignContactUrl(proof.retrievalUrls[0] ?? "") !==
      canonicalCampaignContactUrl(proof.websiteUrl) ||
    canonicalCampaignContactUrl(proof.retrievalUrls.at(-1) ?? "") !==
      canonicalCampaignContactUrl(destination.url)
  )
    throw new Error(
      "Campaign contact proof must bind the actual recorded fresh destination and redirect chain",
    );
  const age = Date.parse(dossier.createdAt) - Date.parse(destination.fetchedAt);
  if (age < 0 || age > 86_400_000)
    throw new Error("Campaign contact destination must be freshly retrieved");
}

export const candidateModelAttestationSchema = z.object({
  role: z.enum(["author", "reviewer"]),
  actorId: text,
  runId: z.uuid(),
  configuredModel: text,
  actualModel: text,
  provider: text,
  requestId: text.nullable(),
  promptVersion: text,
  policyVersion: text,
  sourceSetDigest: digest,
  dossierDigest: digest,
  revisionDigest: digest,
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
  }),
  costUsd: z.number().nonnegative().nullable(),
});
export type CandidateModelAttestation = z.infer<
  typeof candidateModelAttestationSchema
>;

export function candidateFinanceSemanticProjection(
  finance: CandidateEvidenceDossier["finance"],
) {
  if (!finance) return finance;
  const { updatedAt: _observedAt, ...content } = finance;
  return content;
}
export function candidateDossierSemanticProjection(
  dossier: CandidateEvidenceDossier,
) {
  const {
    dossierDigest: _digest,
    createdAt: _createdAt,
    sources: _sources,
    ...semantic
  } = dossier;
  return {
    ...semantic,
    ...(semantic.finance
      ? { finance: candidateFinanceSemanticProjection(semantic.finance) }
      : {}),
  };
}
export function candidateDossierSourceProjection(
  sources: CandidateEvidenceDossier["sources"],
) {
  return sources
    .map(({ id, url, publisher, format, contentHash, byteHash }) => ({
      id,
      url,
      publisher,
      format,
      contentHash,
      ...(format === "image" && byteHash ? { byteHash } : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
