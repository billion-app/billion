import { z } from "zod/v4";

import { candidateBriefIdentitySchema } from "./candidate-brief";
import { researchSourceSchema } from "./candidate-research-collection";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1);
export const californiaSourceProofRefSchema = z.object({
  url: z.url(),
  contentHash: hash,
  byteHash: hash.optional(),
  role: z.enum(["required_fresh", "historical_qualification"]).optional(),
});
export const californiaOfficeFamilySchema = z.enum([
  "statewide",
  "board_of_equalization",
  "us_house",
  "state_senate",
  "state_assembly",
  "judicial_retention",
  "local",
]);
export const clarityRosterDerivationSchema = z.object({
  algorithmVersion: z.literal("scc-clarity-semantic-v1"),
  fromSnapshotId: hash,
  reviewedDefinitionHash: hash,
  observedDefinitionHash: hash,
  semanticDigest: hash,
  checkedAt: z.iso.datetime(),
});
export type ClarityRosterDerivation = z.infer<
  typeof clarityRosterDerivationSchema
>;
export const californiaRaceTargetSchema = z.object({
  raceKey: text,
  contestId: text,
  jurisdiction: text,
  jurisdictionLabel: text,
  electionDate: z.iso.date(),
  sourceContestId: text,
  officeFamily: californiaOfficeFamilySchema,
  office: text,
  district: text.nullable(),
  kind: z.enum(["election", "retention"]),
  voteFor: z.number().int().positive().optional(),
  territoryProof: z
    .union([
      z.object({
        url: z.url(),
        contentHash: hash,
        excerpt: text,
        locator: text,
      }),
      z.object({
        kind: z.literal("reviewed_crosswalk"),
        digest: hash,
        actorId: text,
        reviewedAt: z.iso.datetime(),
        method: text,
        reason: text,
        proofs: z.array(californiaSourceProofRefSchema).min(1),
        observedProofs: z.array(californiaSourceProofRefSchema).optional(),
        derivation: clarityRosterDerivationSchema.optional(),
      }),
    ])
    .optional(),
  rosterDigest: hash,
  rosterSourceUrl: z.url().optional(),
  sourceProof: z
    .object({ url: z.url(), contentHash: hash, locator: text })
    .optional(),
  members: z
    .array(
      z.object({
        identity: candidateBriefIdentitySchema,
        candidateId: text,
        name: text,
        sourceCandidateId: text,
        partyCode: z.string(),
        party: text.nullable(),
        sourceProof: z
          .object({
            url: z.url(),
            contentHash: hash,
            excerpt: text,
            locator: text,
          })
          .optional(),
        ballotStatus: z.enum([
          "on_ballot",
          "withdrawn_on_ballot",
          "qualified_write_in",
        ]),
      }),
    )
    .min(1),
});
export const sanJoseScopeCrosswalkSchema = z.object({
  schemaVersion: z.literal(1),
  electionDate: z.literal("2026-11-03"),
  rosterSourceHash: hash,
  method: text,
  entries: z
    .array(
      z.object({
        sourceContestId: text,
        status: z.enum(["include", "exclude", "pending", "off_ballot"]),
        reason: text,
        jurisdiction: text.optional(),
        jurisdictionLabel: text.optional(),
        district: text.nullable().optional(),
        proofs: z.array(californiaSourceProofRefSchema).min(1),
      }),
    )
    .length(129),
  review: z.object({
    digest: hash,
    actorId: text,
    reviewedAt: z.iso.datetime(),
  }),
});
export type SanJoseScopeCrosswalk = z.infer<typeof sanJoseScopeCrosswalkSchema>;

export const clarityCandidateCrosswalkSchema = z.object({
  schemaVersion: z.literal(1),
  electionDate: z.literal("2026-11-03"),
  definitionHash: hash,
  members: z
    .array(
      z.object({
        sourceContestId: text,
        sourceOrdinal: text,
        clarityContestKey: text,
        clarityChoiceIndex: z.number().int().nonnegative(),
        name: text,
        status: z.enum(["on_ballot", "qualified_write_in"]),
        officialCandidateId: text.optional(),
      }),
    )
    .min(1)
    .max(1000),
  review: z.object({
    digest: hash,
    actorId: text,
    reviewedAt: z.iso.datetime(),
  }),
});
export type ClarityCandidateCrosswalk = z.infer<
  typeof clarityCandidateCrosswalkSchema
>;

export const authorityRenewalProjectionIdSchema = z.enum([
  "cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1",
  "mvla-trustee-authority-seven-asset-versions-v1",
  "cde-data-ca-gov-school-district-areas-2025-26-related-harvest-v1",
]);
export const authorityRenewalProjectionSchema = z.object({
  projectionId: authorityRenewalProjectionIdSchema,
  url: z.url(),
  publisher: text,
  format: z.literal("text"),
  reviewedContentHash: hash,
  reviewedRawHash: hash,
  canonicalDigest: hash,
  reviewedSource: researchSourceSchema,
  approval: z.object({
    actorId: text,
    reviewedAt: z.iso.datetime(),
    receiptHash: hash,
    scopeDigest: hash,
    reviewedSourceBundleHash: hash,
  }),
});
export const authorityRenewalProofSchema = z.object({
  projectionId: authorityRenewalProjectionIdSchema,
  url: z.url(),
  publisher: text,
  format: z.literal("text"),
  reviewedContentHash: hash,
  reviewedRawHash: hash,
  observedContentHash: hash,
  observedRawHash: hash,
  canonicalDigest: hash,
  approvalReceiptHash: hash,
  checkedAt: z.iso.datetime(),
});
export type AuthorityRenewalProjection = z.infer<
  typeof authorityRenewalProjectionSchema
>;
export type AuthorityRenewalProof = z.infer<typeof authorityRenewalProofSchema>;

export const californiaRosterSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  id: hash,
  electionDate: z.iso.date(),
  scope: z.enum(["ca_sos_certified", "ca_sos_certified_and_san_jose"]),
  localCoverage: z
    .object({
      scope: z.literal("san_jose"),
      status: z.enum(["pending", "verified"]),
      expectedCandidates: z.number().int().nonnegative().nullable(),
      expectedRaces: z.number().int().nonnegative().nullable(),
      notes: text,
      pendingRaces: z.number().int().nonnegative().optional(),
      pendingCandidates: z.number().int().nonnegative().optional(),
    })
    .optional(),
  scopeLabel: text,
  source: z.object({
    url: z.url(),
    byteHash: hash,
    textHash: hash,
    fetchedAt: z.iso.datetime(),
    encoding: z.literal("windows-1252"),
    text,
  }),
  certification: z.object({
    byteHash: hash.optional(),
    url: z.url(),
    textHash: hash,
    fetchedAt: z.iso.datetime(),
    text,
  }),
  races: z.array(californiaRaceTargetSchema).min(1),
  additionalSources: z.array(researchSourceSchema).max(200).optional(),
  localCrosswalk: sanJoseScopeCrosswalkSchema.optional(),
  localPrimary: z
    .object({
      kind: z.literal("scc_clarity"),
      definitionURL: z.url(),
      settingsURL: z.url(),
      currentVersionURL: z.url(),
      identityCrosswalk: clarityCandidateCrosswalkSchema,
      sourceRenewalProjections: z
        .array(authorityRenewalProjectionSchema)
        .max(3)
        .optional(),
      sourceProjectionProofs: z
        .array(authorityRenewalProofSchema)
        .max(3)
        .optional(),
      reviewedSources: z.array(researchSourceSchema).max(200).optional(),
      derivation: clarityRosterDerivationSchema.optional(),
    })
    .optional(),
  historicalSources: z.array(researchSourceSchema).max(20).optional(),
  excludedContests: z.array(
    z.object({ sourceContestId: text, reason: z.literal("proposition") }),
  ),
  countyCoverage: z.array(
    z.object({
      fips: text,
      name: text,
      status: z.literal("not_enumerated"),
      sourceUrl: z.url().optional(),
    }),
  ),
});
export type CaliforniaOfficeFamily = z.infer<
  typeof californiaOfficeFamilySchema
>;
export type CaliforniaRaceTarget = z.infer<typeof californiaRaceTargetSchema>;
export type CaliforniaRosterSnapshot = z.infer<
  typeof californiaRosterSnapshotSchema
>;
