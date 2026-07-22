import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, inArray, lte } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalGovernmentMeeting,
  LocalGovernmentMeetingItem,
  LocalGovernmentVote,
} from "@acme/db/schema";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";

export const localGovernmentRouter = {
  listMeetings: publicProcedure
    .input(
      z
        .object({
          provider: z.string().min(1).optional(),
          jurisdiction: z.string().min(1).optional(),
          daysAhead: z.number().int().min(1).max(180).default(90),
          includePastDays: z.number().int().min(0).max(90).default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const start = new Date();
      start.setDate(start.getDate() - (input?.includePastDays ?? 0));
      const end = new Date();
      end.setDate(end.getDate() + (input?.daysAhead ?? 90));
      const filters = [
        gte(LocalGovernmentMeeting.startsAt, start),
        lte(LocalGovernmentMeeting.startsAt, end),
      ];
      if (input?.provider) {
        filters.push(eq(LocalGovernmentMeeting.provider, input.provider));
      }
      if (input?.jurisdiction) {
        filters.push(
          eq(LocalGovernmentMeeting.jurisdiction, input.jurisdiction),
        );
      }
      return db
        .select()
        .from(LocalGovernmentMeeting)
        .where(and(...filters))
        .orderBy(asc(LocalGovernmentMeeting.startsAt));
    }),

  getMeeting: publicProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        jurisdiction: z.string().min(1),
        sourceId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const [meeting] = await db
        .select()
        .from(LocalGovernmentMeeting)
        .where(
          and(
            eq(LocalGovernmentMeeting.provider, input.provider),
            eq(LocalGovernmentMeeting.jurisdiction, input.jurisdiction),
            eq(LocalGovernmentMeeting.sourceId, input.sourceId),
          ),
        )
        .limit(1);
      if (!meeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }

      const items = await db
        .select()
        .from(LocalGovernmentMeetingItem)
        .where(
          and(
            eq(LocalGovernmentMeetingItem.provider, input.provider),
            eq(LocalGovernmentMeetingItem.jurisdiction, input.jurisdiction),
            eq(LocalGovernmentMeetingItem.meetingSourceId, input.sourceId),
          ),
        )
        .orderBy(asc(LocalGovernmentMeetingItem.sequence));
      const itemIds = items.map((item) => item.sourceId);
      const votes =
        itemIds.length === 0
          ? []
          : await db
              .select()
              .from(LocalGovernmentVote)
              .where(
                and(
                  eq(LocalGovernmentVote.provider, input.provider),
                  eq(LocalGovernmentVote.jurisdiction, input.jurisdiction),
                  inArray(LocalGovernmentVote.itemSourceId, itemIds),
                ),
              )
              .orderBy(
                asc(LocalGovernmentVote.itemSourceId),
                asc(LocalGovernmentVote.sort),
              );

      return {
        ...meeting,
        items: items.map((item) => ({
          ...item,
          votes: votes.filter((vote) => vote.itemSourceId === item.sourceId),
        })),
      };
    }),
} satisfies TRPCRouterRecord;
