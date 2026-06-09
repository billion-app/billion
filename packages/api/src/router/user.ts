import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { SavedArticle, UserPreferences } from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

const DEFAULT_PREFERENCES = {
  explainerLength: "standard" as const,
  readingLevel: "accessible" as const,
};

export const userRouter = {
  // Fetch the authenticated user's reading preferences.
  // Returns hard-coded defaults if no preferences row exists yet.
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select()
      .from(UserPreferences)
      .where(eq(UserPreferences.userId, ctx.session.user.id))
      .limit(1);
    return row ?? DEFAULT_PREFERENCES;
  }),

  // Upsert the authenticated user's reading preferences.
  updatePreferences: protectedProcedure
    .input(
      z.object({
        explainerLength: z.enum(["concise", "standard", "comprehensive"]),
        readingLevel: z.enum(["technical", "accessible", "balanced"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .insert(UserPreferences)
        .values({
          userId: ctx.session.user.id,
          ...input,
        })
        .onConflictDoUpdate({
          target: UserPreferences.userId,
          set: {
            ...input,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    }),

  isArticleSaved: protectedProcedure
    .input(z.object({ contentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select({ id: SavedArticle.id })
        .from(SavedArticle)
        .where(
          and(
            eq(SavedArticle.userId, ctx.session.user.id),
            eq(SavedArticle.contentId, input.contentId),
          ),
        )
        .limit(1);
      return { saved: !!row };
    }),

  saveArticle: protectedProcedure
    .input(
      z.object({
        contentId: z.uuid(),
        contentType: z.enum(["bill", "government_content", "court_case"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(SavedArticle)
        .values({
          userId: ctx.session.user.id,
          contentId: input.contentId,
          contentType: input.contentType,
        })
        .onConflictDoNothing();
    }),

  unsaveArticle: protectedProcedure
    .input(z.object({ contentId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(SavedArticle)
        .where(
          and(
            eq(SavedArticle.userId, ctx.session.user.id),
            eq(SavedArticle.contentId, input.contentId),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
