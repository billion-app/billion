import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { JURISDICTIONS, legistar } from "../integrations/legistar";
import { publicProcedure } from "../trpc";

const jurisdictionEnum = z.enum(["sanjose", "santaclara", "sunnyvale"]);

export const legistarRouter = {
  getLocalBills: publicProcedure.query(async () => {
    try {
      const [sanjose, santaclara] = await Promise.all([
        legistar.getLegislation("sanjose", {}).catch(() => []),
        legistar.getLegislation("santaclara", {}).catch(() => []),
      ]);

      const allBills = [
        ...sanjose.map((b) => ({ ...b, jurisdiction: "San Jose" as const })),
        ...santaclara.map((b) => ({
          ...b,
          jurisdiction: "Santa Clara County" as const,
        })),
      ];

      return allBills
        .sort(
          (a, b) =>
            new Date(b.MatterLastModifiedUtc).getTime() -
            new Date(a.MatterLastModifiedUtc).getTime(),
        )
        .slice(0, 10);
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch local bills",
        cause: error,
      });
    }
  }),

  getMeetings: publicProcedure
    .input(
      z
        .object({
          jurisdiction: jurisdictionEnum.optional(),
          daysAhead: z.number().min(1).max(90).default(30),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        const jurisdictions = input?.jurisdiction
          ? [input.jurisdiction]
          : (["sanjose", "santaclara"] as const);
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + (input?.daysAhead ?? 30));

        const results = await Promise.all(
          jurisdictions.map(async (j) => {
            const meetings = await legistar
              .getMeetings(j, { start, end })
              .catch(() => []);
            return meetings.map((m) => ({
              ...m,
              jurisdiction: JURISDICTIONS[j].name,
            }));
          }),
        );

        return results
          .flat()
          .sort(
            (a, b) =>
              new Date(a.EventDate).getTime() - new Date(b.EventDate).getTime(),
          );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch meetings",
          cause: error,
        });
      }
    }),

  getAgenda: publicProcedure
    .input(
      z.object({
        jurisdiction: jurisdictionEnum,
        meetingId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await legistar.getAgendas(input.jurisdiction, input.meetingId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch agenda",
          cause: error,
        });
      }
    }),

  getVotes: publicProcedure
    .input(
      z.object({
        jurisdiction: jurisdictionEnum,
        eventItemId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await legistar.getVotes(input.jurisdiction, input.eventItemId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch votes",
          cause: error,
        });
      }
    }),

  getBodies: publicProcedure
    .input(
      z.object({
        jurisdiction: jurisdictionEnum,
      }),
    )
    .query(async ({ input }) => {
      try {
        return await legistar.getBodies(input.jurisdiction);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch bodies",
          cause: error,
        });
      }
    }),

  getMeetingVotes: publicProcedure
    .input(
      z.object({
        jurisdiction: jurisdictionEnum,
        meetingId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await legistar.getMeetingVotes(
          input.jurisdiction,
          input.meetingId,
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch meeting votes",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
