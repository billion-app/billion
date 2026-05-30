import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  ElectionRecord,
  ContestRecord,
  CandidateRecord,
  PollingLocationRecord,
} from "@acme/db/schema";

import { publicProcedure } from "../trpc";

export const localElectionsRouter = {
  list: publicProcedure.query(async () => {
    return db
      .select()
      .from(ElectionRecord)
      .orderBy(desc(ElectionRecord.date))
      .limit(20);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [election] = await db
        .select()
        .from(ElectionRecord)
        .where(eq(ElectionRecord.id, input.id))
        .limit(1);
      if (!election) throw new Error("Election not found");

      const contests = await db
        .select()
        .from(ContestRecord)
        .where(eq(ContestRecord.electionId, input.id));

      const contestsWithCandidates = await Promise.all(
        contests.map(async (contest) => {
          const candidates = contest.type === "candidate"
            ? await db
                .select()
                .from(CandidateRecord)
                .where(eq(CandidateRecord.contestId, contest.id))
            : [];
          return { ...contest, candidates };
        }),
      );

      return { ...election, contests: contestsWithCandidates };
    }),

  pollingLocations: publicProcedure
    .input(
      z.object({
        electionId: z.string().uuid().optional(),
        type: z
          .enum(["polling_place", "early_vote", "drop_box"])
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      let query = db.select().from(PollingLocationRecord).$dynamic();
      if (input.electionId) {
        query = query.where(
          eq(PollingLocationRecord.electionId, input.electionId),
        );
      }
      return query.limit(100);
    }),
} satisfies TRPCRouterRecord;
