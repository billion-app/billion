import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  getLocalGovernmentMeeting,
  getLocalGovernmentMeetings,
} from "../lib/local-government";
import { publicProcedure } from "../trpc";

const meetingListInput = z
  .object({
    jurisdiction: z.string().trim().min(1).optional(),
    start: z.date().optional(),
    end: z.date().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    daysAhead: z.number().int().min(1).max(180).optional(),
    includePastDays: z.number().int().min(0).max(90).optional(),
  })
  .optional();

function resolveMeetingRange(input: z.infer<typeof meetingListInput>) {
  if (!input?.daysAhead && input?.includePastDays === undefined) {
    return { start: input?.start, end: input?.end };
  }
  const start = input.start ?? new Date();
  start.setDate(start.getDate() - (input.includePastDays ?? 0));
  const end = input.end ?? new Date();
  end.setDate(end.getDate() + (input.daysAhead ?? 90));
  return { start, end };
}

async function listMeetings(input: z.infer<typeof meetingListInput>) {
  const range = resolveMeetingRange(input);
  return getLocalGovernmentMeetings({
    jurisdiction: input?.jurisdiction,
    start: range.start,
    end: range.end,
    limit: input?.limit ?? 50,
  });
}

async function getMeeting(id: string) {
  const meeting = await getLocalGovernmentMeeting(id);
  if (!meeting) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
  }
  return meeting;
}

export const localGovernmentRouter = {
  meetings: publicProcedure.input(meetingListInput).query(({ input }) =>
    listMeetings(input),
  ),
  listMeetings: publicProcedure.input(meetingListInput).query(({ input }) =>
    listMeetings(input),
  ),
  meeting: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(({ input }) => getMeeting(input.id)),
  getMeeting: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(({ input }) => getMeeting(input.id)),
} satisfies TRPCRouterRecord;
