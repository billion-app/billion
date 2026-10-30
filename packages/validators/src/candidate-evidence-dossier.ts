import { z } from "zod/v4";

import { candidateBriefIdentitySchema } from "./candidate-brief";
import { campaignFinanceSchema } from "./candidate-research";
import { researchSourceSchema } from "./candidate-research-collection";

const text = z.string().trim().min(1).max(4000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
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
    "local",
  ]),
  rosterDigest: digest,
  researchVersion: text,
  createdAt: z.iso.datetime(),
  finance: campaignFinanceSchema.nullable().optional(),
  sources: z.array(researchSourceSchema).min(1).max(40),
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
