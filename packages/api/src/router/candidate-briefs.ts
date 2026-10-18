import { z } from "zod/v4";

import { and, eq, inArray, sql } from "@acme/db";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
} from "@acme/db/schema";
import {
  candidateBriefIdentitySchema,
  candidateRaceManifestSchema,
} from "@acme/validators";

import type { PublishedCandidateRace } from "../lib/candidate-race-release";
import type { createTRPCContext } from "../trpc";
import { readCandidateRace } from "../lib/candidate-race-release";
import { activeResearchPolicy } from "../lib/candidate-research-store";
import { publicProcedure } from "../trpc";

interface Policy {
  approved: boolean;
  version: string;
}
type PolicyInput =
  | Policy
  | ((
      database: Pick<
        Awaited<ReturnType<typeof createTRPCContext>>["db"],
        "select"
      >,
    ) => Promise<Policy>);
async function readReleases(
  database: Awaited<ReturnType<typeof createTRPCContext>>["db"],
  policyInput: PolicyInput,
  releaseId?: string,
): Promise<{ policy: Policy; races: PublishedCandidateRace[] }> {
  if (typeof policyInput !== "function" && !policyInput.approved)
    return { policy: policyInput, races: [] };
  return database.transaction(
    async (tx) => {
      const policy =
        typeof policyInput === "function" ? await policyInput(tx) : policyInput;
      if (!policy.approved) return { policy, races: [] };
      // Rank before limiting so repeated snapshots of one race cannot evict another.
      // Filtering the requested ID happens after ranking: old URLs cannot revive superseded research.
      const latest = tx
        .select({
          id: CandidateRaceRelease.id,
          document: CandidateRaceRelease.document,
          revokedReason: CandidateRaceRelease.revokedReason,
          rank: sql<number>`row_number() over (
          partition by ${CandidateRaceRelease.document}->>'jurisdiction', ${CandidateRaceRelease.document}->>'electionDate', ${CandidateRaceRelease.document}->>'contestId'
          order by ${CandidateRaceRelease.createdAt} desc, ${CandidateRaceRelease.id} desc
        )`.as("race_rank"),
        })
        .from(CandidateRaceRelease)
        .as("latest_races");
      const stored = await tx
        .select()
        .from(latest)
        .where(
          and(
            eq(latest.rank, 1),
            releaseId ? eq(latest.id, releaseId) : undefined,
          ),
        )
        .limit(100);
      const releases = [];
      for (const release of stored) {
        const parsed = candidateRaceManifestSchema.safeParse(release.document);
        if (!parsed.success) continue;
        releases.push({ ...release, document: parsed.data });
      }
      const ids = releases.flatMap((r) =>
        r.document.members.map((m) => m.revisionId),
      );
      if (!ids.length) return { policy, races: [] };
      const revisions = await tx
        .select()
        .from(CandidateBriefRevision)
        .where(inArray(CandidateBriefRevision.id, ids));
      const events = await tx
        .select()
        .from(CandidateBriefReviewEvent)
        .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
      const races = releases.flatMap((release) => {
        const race = readCandidateRace({
          manifest: release.document,
          revokedReason: release.revokedReason,
          revisions,
          events,
          now: new Date().toISOString(),
          policy,
        });
        return race ? [race] : [];
      });
      return { policy, races };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
/** Dependency is server-owned; no request parameter or environment flag can approve policy. */
export function createCandidateBriefsRouter(policyInput: PolicyInput) {
  return {
    listRaces: publicProcedure.query(async ({ ctx }) =>
      (await readReleases(ctx.db, policyInput)).races.map((race) => ({
        id: race.manifest.id,
        office: race.manifest.office,
        jurisdiction: race.manifest.jurisdictionLabel,
        electionDate: race.manifest.electionDate,
        candidateCount: race.manifest.members.length,
      })),
    ),
    race: publicProcedure
      .input(z.object({ releaseId: z.uuid() }))
      .query(
        async ({ ctx, input }) =>
          (await readReleases(ctx.db, policyInput, input.releaseId)).races[0] ??
          null,
      ),
    get: publicProcedure
      .input(candidateBriefIdentitySchema)
      .query(async ({ ctx, input }) => {
        const { policy, races } = await readReleases(ctx.db, policyInput);
        const race = races.find(
          (r) =>
            r.manifest.contestId === input.contestId &&
            r.manifest.jurisdiction === input.jurisdiction &&
            r.manifest.electionDate === input.electionDate &&
            r.manifest.members.some((m) => m.candidateId === input.candidateId),
        );
        return {
          status: race
            ? ("published" as const)
            : policy.approved
              ? ("unavailable" as const)
              : ("policy_pending" as const),
          brief:
            race?.briefs.find(
              (b) => b.identity.candidateId === input.candidateId,
            ) ?? null,
          coverage: {
            reviewedCandidates: race?.briefs.length ?? 0,
            rosterCandidates: race?.manifest.members.length ?? null,
            completeRace: !!race,
          },
        };
      }),
  };
}
export const candidateBriefsRouter =
  createCandidateBriefsRouter(activeResearchPolicy);
