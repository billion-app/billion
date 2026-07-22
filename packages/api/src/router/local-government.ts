import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  getLocalGovernmentMeeting,
  getLocalGovernmentMeetings,
} from "../lib/local-government";
import { publicProcedure } from "../trpc";

export const localGovernmentRouter = {
  meetings: publicProcedure
    .input(
      z
        .object({
          jurisdiction: z.string().trim().min(1).default("cedar-park-tx"),
          start: z.date().optional(),
          end: z.date().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(({ input }) =>
      getLocalGovernmentMeetings({
        jurisdiction: input?.jurisdiction ?? "cedar-park-tx",
        start: input?.start,
        end: input?.end,
        limit: input?.limit ?? 50,
      }),
    ),

  meeting: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ input }) => {
      const meeting = await getLocalGovernmentMeeting(input.id);
      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }
      return meeting;
    }),
} satisfies TRPCRouterRecord;
