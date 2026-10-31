import { z } from "zod/v4";

import type { CandidateBrief } from "./candidate-brief";
import type { CandidateResearchQuality } from "./candidate-research";
import {
  candidateBriefIdentitySchema,
  candidateEvidenceAttributionSchema,
} from "./candidate-brief";
import {
  campaignFinanceSchema,
  hasSubstantiveCampaignFinance,
} from "./candidate-research";
import { researchSourceSchema } from "./candidate-research-collection";
import { resolveFecIdentityFromSource } from "./fec-candidate-identity";

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
export const candidateEvidenceDossierSchema = z
  .object({
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
            "campaign_material",
            "candidate_record",
            "finance",
          ]),
          identityQualification: z.enum([
            "official_roster",
            "official_cross_link",
            "exact_election_office",
          ]),
          attribution: candidateEvidenceAttributionSchema.optional(),
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
  })
  .superRefine((dossier, context) => {
    const sources = new Map(
      dossier.sources.map((source) => [source.id, source]),
    );
    for (const entry of dossier.evidence) {
      const attribution = entry.attribution;
      if (
        entry.role === "campaign_material" &&
        (entry.origin !== "candidate" || attribution?.status !== "unresolved")
      )
        context.addIssue({
          code: "custom",
          message:
            "Campaign-published material requires unresolved speaker attribution and candidate-publisher provenance",
        });
      if (!attribution) continue;
      const source = sources.get(entry.sourceId);
      if (
        !source ||
        !source.text.includes(attribution.context.excerpt) ||
        !attribution.context.excerpt.includes(entry.excerpt)
      )
        context.addIssue({
          code: "custom",
          message:
            "Speaker context must be a full exact archived passage containing the selected excerpt",
        });
      if (entry.origin !== "candidate")
        context.addIssue({
          code: "custom",
          message:
            "Candidate publication attribution requires candidate-publisher provenance",
        });
      if (attribution.status === "official_candidate_statement") {
        const url = source ? new URL(source.url) : null;
        if (
          entry.role !== "candidate_statement" ||
          url?.protocol !== "https:" ||
          url.hostname !== "voterguide.sos.ca.gov" ||
          !url.pathname.startsWith("/candidates/")
        )
          context.addIssue({
            code: "custom",
            message:
              "Official candidate-statement attribution requires the verified official submission channel",
          });
      } else if (entry.role !== "campaign_material")
        context.addIssue({
          code: "custom",
          message:
            "Unresolved campaign speaker attribution requires campaign_material role",
        });
    }
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
    destination?.retrievalUrls?.length !== proof.retrievalUrls.length ||
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
  // JSONB may reorder keys; compare schema-normalized semantic values.
  const { updatedAt: _observedAt, ...content } =
    campaignFinanceSchema.parse(finance);
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

export function deriveCandidateResearchQuality(
  brief: CandidateBrief,
  dossier: CandidateEvidenceDossier,
): CandidateResearchQuality | null {
  const publishedEvidence = new Set(brief.evidence.map((entry) => entry.id));
  const candidateEvidence = new Set(
    dossier.evidence
      .filter((entry) =>
        [
          "candidate_statement",
          "candidate_record",
          "campaign_material",
        ].includes(entry.role),
      )
      .map((entry) => entry.id),
  );
  for (const topic of ["record", "priorities"] as const) {
    const claims =
      brief.sections
        .find((section) => section.topic === topic)
        ?.claims.filter((claim) =>
          claim.evidenceIds.some(
            (id) => candidateEvidence.has(id) && publishedEvidence.has(id),
          ),
        ) ?? [];
    if (claims.length)
      return {
        basis: topic === "record" ? "candidate_record" : "candidate_priorities",
        claimIds: claims.map((claim) => claim.id),
        evidenceIds: [
          ...new Set(
            claims.flatMap((claim) =>
              claim.evidenceIds.filter(
                (id) => candidateEvidence.has(id) && publishedEvidence.has(id),
              ),
            ),
          ),
        ].sort(),
      };
  }
  const finance = brief.research?.finance;
  const proof = dossier.financeIdentityProof;
  if (
    !finance ||
    !dossier.finance ||
    !proof ||
    dossier.officeKind !== "federal_legislative" ||
    JSON.stringify(candidateFinanceSemanticProjection(finance)) !==
      JSON.stringify(candidateFinanceSemanticProjection(dossier.finance))
  )
    return null;
  const index = dossier.sources.find(
    (source) =>
      source.id === proof.sourceId && source.contentHash === proof.sourceHash,
  );
  if (!index) return null;
  const district = /\/cd:(\d+)(?:\/|$)/.exec(
    dossier.identity.jurisdiction,
  )?.[1];
  try {
    if (!district) return null;
    const matched = resolveFecIdentityFromSource(index, {
      name: dossier.name,
      district,
      cycle: Number(dossier.identity.electionDate.slice(0, 4)),
    });
    if (
      matched?.candidateId !== proof.candidateId ||
      matched.name !== proof.name ||
      Number(matched.district) !== Number(proof.district) ||
      matched.cycle !== proof.cycle
    )
      return null;
  } catch {
    return null;
  }
  const ids = [
    ...finance.filingEvidenceIds,
    ...finance.donors.flatMap((donor) => donor.evidenceIds),
    ...(finance.outsideSpending?.flatMap((entry) => entry.evidenceIds) ?? []),
  ];
  if (
    ids.some(
      (id) =>
        !publishedEvidence.has(id) ||
        !dossier.evidence.some(
          (entry) =>
            entry.id === id &&
            entry.role === "finance" &&
            entry.origin === "primary_record",
        ),
    )
  )
    return null;
  if (!hasSubstantiveCampaignFinance(finance)) return null;
  const evidenceIds = [...new Set(ids)].sort();
  return {
    basis: "reconciled_finance",
    claimIds: brief.sections
      .flatMap((section) => section.claims)
      .filter((claim) =>
        claim.evidenceIds.some((id) => evidenceIds.includes(id)),
      )
      .map((claim) => claim.id),
    evidenceIds,
  };
}
export function hasSubstantiveCandidateResearch(
  brief: CandidateBrief,
  dossier: CandidateEvidenceDossier,
): boolean {
  return deriveCandidateResearchQuality(brief, dossier) !== null;
}
