import { z } from "zod/v4";

const text = z.string().trim().min(1).max(4000);
const refs = z.array(text).min(1).max(30);
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Emphasis is editorial content and is covered by the revision's review digest. */
export const researchPointSchema = z
  .object({
    title: text,
    text,
    emphasis: z.array(text).max(4).default([]),
    evidenceIds: refs,
  })
  .superRefine((point, ctx) => {
    if (point.emphasis.some((phrase) => !point.text.includes(phrase)))
      ctx.addIssue({
        code: "custom",
        message: "Emphasis must quote the displayed text",
      });
  });
export const interestLabels = {
  labor: "Labor & employment",
  business: "Business & industry",
  housing: "Housing & real estate",
  health: "Health care",
  environment: "Energy & environment",
  education: "Education",
  rights: "Civil rights & social issues",
  foreign_policy: "Foreign policy",
} as const;
export const donorTypeLabels = {
  individual: "Individual",
  committee: "Political committee",
  organization: "Other organization",
  unknown: "Donor type not established",
} as const;
export const receiptLabels = {
  individuals: "Individuals",
  committees: "Committees",
  self_contributions: "Candidate contributions",
  candidate_loans: "Candidate loans",
  transfers: "Transfers",
  other: "Other receipts",
} as const;

export const campaignFinanceSchema = z
  .object({
    committeeId: text,
    committeeName: text,
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    currency: z.literal("USD"),
    coverage: z.enum(["complete", "partial"]),
    coverageNote: text,
    updatedAt: z.iso.datetime(),
    filingEvidenceIds: refs,
    receipts: z
      .object({
        totalCents: cents,
        breakdown: z.object({
          individuals: cents,
          committees: cents,
          self_contributions: cents,
          candidate_loans: cents,
          transfers: cents,
          other: cents,
        }),
        refundsCents: cents.nullable(),
      })
      .nullable(),
    donors: z
      .array(
        z.object({
          id: text,
          name: text,
          type: z.enum(
            Object.keys(donorTypeLabels) as [
              keyof typeof donorTypeLabels,
              ...(keyof typeof donorTypeLabels)[],
            ],
          ),
          amountCents: cents,
          evidenceIds: refs,
          lobbying: researchPointSchema.nullable(),
          interests: z
            .array(
              z.object({
                area: z.enum(
                  Object.keys(interestLabels) as [
                    keyof typeof interestLabels,
                    ...(keyof typeof interestLabels)[],
                  ],
                ),
                evidenceIds: refs,
              }),
            )
            .max(8),
          positions: z.array(researchPointSchema).max(20),
        }),
      )
      .max(500),
    donorAmounts: z.enum(["donor_total", "contribution"]).optional(),
    donorCoverage: z.enum(["all_itemized", "selected", "unavailable"]),
    outsideSpending: z
      .array(
        z.object({
          id: text,
          spender: text,
          direction: z.enum(["support", "oppose", "unspecified"]),
          amountCents: cents,
          evidenceIds: refs,
        }),
      )
      .max(500)
      .nullable(),
  })
  .superRefine((finance, ctx) => {
    if (finance.periodStart > finance.periodEnd)
      ctx.addIssue({ code: "custom", message: "Reporting period is reversed" });
    if (
      finance.receipts &&
      Object.values(finance.receipts.breakdown).reduce((a, b) => a + b, 0) !==
        finance.receipts.totalCents
    )
      ctx.addIssue({
        code: "custom",
        message: "Receipt categories must reconcile to the reported total",
      });
    if (new Set(finance.donors.map((d) => d.id)).size !== finance.donors.length)
      ctx.addIssue({ code: "custom", message: "Duplicate donor IDs" });
    if (finance.donorCoverage === "unavailable" && finance.donors.length)
      ctx.addIssue({
        code: "custom",
        message: "Unavailable donor coverage cannot include donors",
      });
    if (
      finance.outsideSpending &&
      new Set(finance.outsideSpending.map((d) => d.id)).size !==
        finance.outsideSpending.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate outside spending IDs",
      });
  });
export const candidateResearchSchema = z
  .object({
    headlineClaimId: text,
    promises: z
      .array(
        z.object({
          claimId: text,
          title: text,
          brief: z.object({
            change: researchPointSchema,
            authority: researchPointSchema,
            unknowns: researchPointSchema,
          }),
          benefits: z.array(researchPointSchema).max(10),
          costs: z.array(researchPointSchema).max(10),
          affected: z.array(researchPointSchema).max(10),
          perspectives: z.array(researchPointSchema).max(10),
          steps: z.array(researchPointSchema).max(10),
          alternatives: z.array(researchPointSchema).max(10),
          unknowns: z.array(researchPointSchema).max(10),
        }),
      )
      .max(30),
    finance: campaignFinanceSchema.nullable(),
    financeGap: text.nullable(),
  })
  .refine(
    (r) => r.finance !== null || r.financeGap !== null,
    "Missing finance needs an explanation",
  );

export const candidateRaceManifestSchema = z
  .object({
    id: z.uuid(),
    contestId: text,
    electionDate: z.iso.date(),
    jurisdiction: text,
    jurisdictionLabel: text,
    office: text,
    rosterSourceUrl: z.url().refine((url) => /^https?:\/\//.test(url)),
    rosterHash: z.string().regex(/^[a-f0-9]{64}$/),
    rosterVerifiedAt: z.iso.datetime(),
    rosterVerifiedBy: text,
    members: z
      .array(
        z.object({
          candidateId: text,
          revisionId: z.uuid(),
          name: text,
          description: text.nullable(),
          ballotStatus: z.enum(["on_ballot", "withdrawn_on_ballot"]),
        }),
      )
      .min(1)
      .max(100),
    policyVersion: text,
    sourceCheckedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    currentHashes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  })
  .superRefine((race, ctx) => {
    if (
      new Set(race.members.map((m) => m.candidateId)).size !==
        race.members.length ||
      new Set(race.members.map((m) => m.revisionId)).size !==
        race.members.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Roster identities and revisions must be unique",
      });
    const checked = Date.parse(race.sourceCheckedAt);
    if (
      Date.parse(race.expiresAt) <= checked ||
      Date.parse(race.expiresAt) - checked > 86_400_000
    )
      ctx.addIssue({
        code: "custom",
        message: "Source checks expire within 24 hours",
      });
  });
export type CampaignFinance = z.infer<typeof campaignFinanceSchema>;
export type ResearchPoint = z.infer<typeof researchPointSchema>;
export type CandidateResearch = z.infer<typeof candidateResearchSchema>;
export type CandidateRaceManifest = z.infer<typeof candidateRaceManifestSchema>;
