import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BlockedContent,
  user,
  UserPreference,
  UserSettings,
} from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

export const userRouter = {
  // --- Content Preferences ---

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const row = await db
      .select()
      .from(UserPreference)
      .where(eq(UserPreference.userId, userId))
      .limit(1);
    return (
      row[0] ?? {
        topics: [
          "Healthcare",
          "Climate",
          "Technology",
          "Housing",
          "Economy",
          "Civil rights",
        ],
        contentTypes: ["bill", "exec", "court", "local"],
      }
    );
  }),

  setPreferences: protectedProcedure
    .input(
      z.object({
        topics: z.array(z.string()),
        contentTypes: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .insert(UserPreference)
        .values({
          userId,
          topics: input.topics,
          contentTypes: input.contentTypes,
        })
        .onConflictDoUpdate({
          target: UserPreference.userId,
          set: {
            topics: input.topics,
            contentTypes: input.contentTypes,
          },
        });
      return { success: true };
    }),

  // --- Blocked Content ---

  getBlocked: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return db
      .select()
      .from(BlockedContent)
      .where(eq(BlockedContent.userId, userId));
  }),

  addBlocked: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["source", "topic"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [row] = await db
        .insert(BlockedContent)
        .values({ userId, name: input.name, type: input.type })
        .onConflictDoNothing()
        .returning();
      return row ?? null;
    }),

  removeBlocked: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .delete(BlockedContent)
        .where(
          and(
            eq(BlockedContent.id, input.id),
            eq(BlockedContent.userId, userId),
          ),
        );
      return { success: true };
    }),

  // --- Privacy/App Settings ---

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const row = await db
      .select()
      .from(UserSettings)
      .where(eq(UserSettings.userId, userId))
      .limit(1);
    return (
      row[0] ?? {
        location: true,
        personalize: true,
        analytics: false,
        crash: true,
        offline: true,
      }
    );
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        location: z.boolean().optional(),
        personalize: z.boolean().optional(),
        analytics: z.boolean().optional(),
        crash: z.boolean().optional(),
        offline: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .insert(UserSettings)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: UserSettings.userId,
          set: input,
        });
      return { success: true };
    }),

  // --- Profile Update ---

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.image !== undefined) updates.image = input.image;
      if (Object.keys(updates).length > 0) {
        await db.update(user).set(updates).where(eq(user.id, userId));
      }
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
