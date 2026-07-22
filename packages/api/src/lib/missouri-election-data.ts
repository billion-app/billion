import { z } from "zod/v4";

import { and, desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { ElectionSourceSnapshot } from "@acme/db/schema";

export const MISSOURI_CYCLE_YEAR = 2026;
export const MISSOURI_CURRENT_SCOPE = "current-2026";
export const MISSOURI_SOS_PROVIDER = "mo-sos";

const citationSchema = z.object({
  label: z.string(),
  sourceUrl: z.url(),
});

const electionSchema = z.object({
  name: z.string(),
  type: z.enum(["primary", "general"]),
  electionDate: z.iso.date(),
  finalCertificationDate: z.iso.date().optional(),
  citation: citationSchema,
});

const candidateSchema = z.object({
  office: z.string(),
  district: z.string().optional(),
  party: z.string(),
  name: z.string(),
  ballotOrder: z.int().positive(),
  status: z.enum(["certified", "withdrawn", "removed"]),
  withdrawalReason: z.string().optional(),
  withdrawalDate: z.iso.date().optional(),
  citation: citationSchema,
});

const measureSchema = z.object({
  officialTitle: z.string(),
  officialBallotLanguage: z.string(),
  fairBallotLanguage: z.string(),
  fiscalStatement: z.string(),
  electionDate: z.iso.date(),
  fullTextUrl: z.url(),
  certificateUrl: z.url(),
  certificationStatus: z.literal("certified"),
  citation: citationSchema,
});

const resultChoiceSchema = z.object({
  name: z.string(),
  party: z.string().optional(),
  votes: z.int().nonnegative(),
  percent: z.number().min(0).max(100).optional(),
});

const resultContestSchema = z.object({
  contest: z.string(),
  district: z.string().optional(),
  choices: z.array(resultChoiceSchema),
  totalVotes: z.int().nonnegative(),
  reportingStatus: z.string().optional(),
  citation: citationSchema,
});

const resultsSchema = z.discriminatedUnion("availability", [
  z.object({
    availability: z.literal("unavailable"),
    diagnostic: z.string(),
    citation: citationSchema,
  }),
  z.object({
    availability: z.literal("available"),
    electionDate: z.iso.date(),
    updatedAt: z.string().optional(),
    contests: z.array(resultContestSchema),
    citation: citationSchema,
  }),
]);

export const missouriSnapshotDataSchema = z.object({
  cycleYear: z.literal(MISSOURI_CYCLE_YEAR),
  activeElection: electionSchema,
  candidates: z.array(candidateSchema),
  ballotMeasures: z.array(measureSchema),
  results: resultsSchema,
  citations: z.array(citationSchema),
});

export type MissouriCitation = z.infer<typeof citationSchema>;
export type MissouriElection = z.infer<typeof electionSchema>;
export type MissouriCandidate = z.infer<typeof candidateSchema>;
export type MissouriBallotMeasure = z.infer<typeof measureSchema>;
export type MissouriResultContest = z.infer<typeof resultContestSchema>;
export type MissouriResults = z.infer<typeof resultsSchema>;
export type MissouriSnapshotData = z.infer<typeof missouriSnapshotDataSchema>;

export interface MissouriCurrentElectionData extends MissouriSnapshotData {
  diagnostics: string[];
  sourceVersion: string;
  contentHash: string;
  fetchedAt: string;
}

/** Read the sole public 2026 Missouri snapshot. No historical selector exists. */
export async function getMissouriCurrentElectionData(): Promise<MissouriCurrentElectionData | null> {
  const [row] = await db
    .select()
    .from(ElectionSourceSnapshot)
    .where(
      and(
        eq(ElectionSourceSnapshot.jurisdiction, "MO"),
        eq(ElectionSourceSnapshot.cycleYear, MISSOURI_CYCLE_YEAR),
        eq(ElectionSourceSnapshot.provider, MISSOURI_SOS_PROVIDER),
        eq(ElectionSourceSnapshot.scope, MISSOURI_CURRENT_SCOPE),
      ),
    )
    .orderBy(desc(ElectionSourceSnapshot.fetchedAt))
    .limit(1);
  if (!row) return null;

  const parsed = missouriSnapshotDataSchema.parse(row.data);
  return {
    ...parsed,
    diagnostics: row.diagnostics,
    sourceVersion: row.sourceVersion,
    contentHash: row.contentHash,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}
