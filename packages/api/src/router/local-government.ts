import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import {
  getLocalMeeting,
  getLocalMeetings,
} from "../integrations/local-government";
import { publicProcedure } from "../trpc";

export const localGovernmentRouter = {
  meetings: publicProcedure
    .input(
      z
        .object({
          provider: z.string().min(1).optional(),
          jurisdiction: z.string().min(1).optional(),
          start: z.date().optional(),
          end: z.date().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(({ input }) => getLocalMeetings(input)),

  meeting: publicProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        jurisdiction: z.string().min(1),
        externalId: z.string().min(1),
      }),
    )
    .query(({ input }) =>
      getLocalMeeting(input.provider, input.jurisdiction, input.externalId),
    ),
} satisfies TRPCRouterRecord;
