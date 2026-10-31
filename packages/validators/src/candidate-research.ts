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

const financeWindow = {
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  updatedAt: z.iso.datetime(),
  evidenceIds: refs,
};
const unavailableFinanceComponent = z.object({
  status: z.literal("unavailable"),
  reason: text,
  evidenceIds: refs,
});
const component = <T extends z.ZodRawShape>(shape: T) =>
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("available"), ...financeWindow, ...shape }),
    unavailableFinanceComponent,
  ]);
export const candidateFinanceObservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    summary: component({
      basis: z.literal("reported_campaign_totals"),
      spentCents: cents.nullable(),
      cashCents: cents.nullable(),
      debtCents: cents.nullable(),
      itemizedIndividualCents: cents.nullable(),
      unitemizedIndividualCents: cents.nullable(),
    }),
    donorSelection: component({
      basis: z.literal("selected_filing_transactions"),
      selection: text,
      filingNumbers: z.array(z.number().int().positive()).min(1).max(20),
      limit: z.number().int().min(1).max(20),
    }),
    independentExpenditures: component({
      basis: z.literal("processed_periodic_reports"),
      completeness: z.literal("complete"),
      supportCents: cents,
      opposeCents: cents,
      transactionCount: z.number().int().nonnegative(),
    }),
    filingStatus: component({
      basis: z.literal("official_filing_index"),
      kind: z.enum(["financial_reports", "committee_threshold_statement"]),
      latestForm: text,
      observedForms: z.array(text).min(1).max(20),
      statement: text.nullable(),
    }),
  })
  .superRefine((observation, ctx) => {
    for (const part of Object.values(observation)) {
      if (
        typeof part === "object" &&
        part.status === "available" &&
        part.periodStart > part.periodEnd
      )
        ctx.addIssue({
          code: "custom",
          message: "Finance component reporting period is reversed",
        });
    }
  });

export const campaignFinanceSchema = z
  .object({
    observation: candidateFinanceObservationSchema.optional(),
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
    const observation = finance.observation;
    if (observation) {
      const donor = observation.donorSelection;
      if (
        donor.status === "available" &&
        (finance.donorCoverage !== "selected" ||
          finance.donorAmounts !== "contribution" ||
          finance.donors.length > donor.limit)
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Selected filing transactions must preserve the declared contribution selection",
        });
      const summary = observation.summary;
      if (
        summary.status === "available" &&
        finance.receipts &&
        summary.itemizedIndividualCents !== null &&
        summary.unitemizedIndividualCents !== null &&
        summary.itemizedIndividualCents + summary.unitemizedIndividualCents !==
          finance.receipts.breakdown.individuals
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Individual itemized and unitemized contributions must reconcile",
        });
      const outside = observation.independentExpenditures;
      if (outside.status === "available") {
        if (
          finance.outsideSpending === null ||
          finance.outsideSpending.some(
            (row) => row.direction === "unspecified",
          ) ||
          finance.outsideSpending
            .filter((row) => row.direction === "support")
            .reduce((total, row) => total + row.amountCents, 0) !==
            outside.supportCents ||
          finance.outsideSpending
            .filter((row) => row.direction === "oppose")
            .reduce((total, row) => total + row.amountCents, 0) !==
            outside.opposeCents ||
          (outside.transactionCount === 0) !==
            (finance.outsideSpending.length === 0)
        )
          ctx.addIssue({
            code: "custom",
            message:
              "Independent expenditure aggregates must reconcile to complete spender records",
          });
      }
      const filing = observation.filingStatus;
      if (
        filing.status === "available" &&
        filing.kind === "committee_threshold_statement" &&
        (finance.receipts !== null ||
          finance.donors.length > 0 ||
          summary.status !== "unavailable" ||
          donor.status !== "unavailable")
      )
        ctx.addIssue({
          code: "custom",
          message:
            "A reporting-threshold statement cannot establish exact campaign amounts or donor coverage",
        });
    }
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
export function candidateFinanceEvidenceIds(
  finance: z.infer<typeof campaignFinanceSchema>,
): string[] {
  return [
    ...new Set([
      ...finance.filingEvidenceIds,
      ...finance.donors.flatMap((row) => row.evidenceIds),
      ...(finance.outsideSpending?.flatMap((row) => row.evidenceIds) ?? []),
      ...(finance.observation
        ? [
            finance.observation.summary,
            finance.observation.donorSelection,
            finance.observation.independentExpenditures,
            finance.observation.filingStatus,
          ].flatMap((part) => part.evidenceIds)
        : []),
    ]),
  ];
}
/** Substantive records can stand alone when no sourced prose claim is available. */
export function hasSubstantiveCampaignFinance(
  finance: z.infer<typeof campaignFinanceSchema> | null | undefined,
): boolean {
  return (
    !!finance &&
    (finance.observation?.filingStatus.status === "available" ||
      finance.receipts !== null ||
      finance.donors.length > 0 ||
      (finance.outsideSpending !== null &&
        (finance.outsideSpending.length > 0 ||
          finance.coverage === "complete")))
  );
}

export const candidateResearchSchema = z
  .object({
    headlineClaimId: text.optional(),
    // Optional so parsing older approved revisions does not change their digest.
    // Definitions are authored and reviewed with the explanation, never inferred by the UI.
    terms: z
      .array(
        z.object({
          term: z.string().trim().min(1).max(120),
          plain: z.string().trim().min(1).max(1000),
        }),
      )
      .max(40)
      .refine(
        (terms) =>
          new Set(terms.map((t) => t.term.toLowerCase())).size === terms.length,
        "Each term must have one definition",
      )
      .optional(),
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
  )
  .refine(
    (r) =>
      r.headlineClaimId !== undefined ||
      (hasSubstantiveCampaignFinance(r.finance) && r.promises.length === 0),
    "Research without a headline requires substantive finance and no promise readings",
  );

export const candidateResearchQualitySchema = z.object({
  basis: z.enum([
    "candidate_record",
    "candidate_priorities",
    "reconciled_finance",
  ]),
  claimIds: z.array(text).max(180),
  evidenceIds: z.array(text).min(1).max(100),
});
export type CandidateResearchQuality = z.infer<
  typeof candidateResearchQualitySchema
>;

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
    rosterSnapshotId: z.string().min(1).max(100).optional(),
    rosterDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    collectionId: z.uuid().optional(),
    reviewedDossiers: z
      .record(
        z.string(),
        z.object({
          dossierDigest: z.string().regex(/^[a-f0-9]{64}$/),
          sourceSetDigest: z.string().regex(/^[a-f0-9]{64}$/),
          authorRunId: z.uuid(),
          quality: candidateResearchQualitySchema.optional(),
        }),
      )
      .optional(),
    sourceDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    rosterVerifiedAt: z.iso.datetime(),
    rosterVerifiedBy: text,
    members: z
      .array(
        z.object({
          candidateId: text,
          revisionId: z.uuid(),
          name: text,
          description: text.nullable(),
          ballotStatus: z.enum([
            "on_ballot",
            "withdrawn_on_ballot",
            "qualified_write_in",
          ]),
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
