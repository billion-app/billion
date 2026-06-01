import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, gte } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  BlockedContent,
  CourtCase,
  Feedback,
  GovernmentContent,
  SavedArticle,
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

  // --- Account Deletion ---

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await db.transaction(async (tx) => {
      await tx.delete(SavedArticle).where(eq(SavedArticle.userId, userId));
      await tx.delete(BlockedContent).where(eq(BlockedContent.userId, userId));
      await tx.delete(UserPreference).where(eq(UserPreference.userId, userId));
      await tx.delete(UserSettings).where(eq(UserSettings.userId, userId));
      await tx.delete(user).where(eq(user.id, userId));
    });
    return { success: true };
  }),

  // --- Saved Articles ---

  getSaved: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const saved = await db
      .select()
      .from(SavedArticle)
      .where(eq(SavedArticle.userId, userId))
      .orderBy(desc(SavedArticle.createdAt));

    const results = await Promise.all(
      saved.map(async (s) => {
        if (s.contentType === "bill") {
          const [row] = await db
            .select({
              id: Bill.id,
              title: Bill.title,
              description: Bill.description,
            })
            .from(Bill)
            .where(eq(Bill.id, s.contentId))
            .limit(1);
          return row
            ? { ...row, type: "bill" as const, savedAt: s.createdAt }
            : null;
        }
        if (s.contentType === "government_content") {
          const [row] = await db
            .select({
              id: GovernmentContent.id,
              title: GovernmentContent.title,
              description: GovernmentContent.description,
            })
            .from(GovernmentContent)
            .where(eq(GovernmentContent.id, s.contentId))
            .limit(1);
          return row
            ? {
                ...row,
                type: "government_content" as const,
                savedAt: s.createdAt,
              }
            : null;
        }
        const [row] = await db
          .select({
            id: CourtCase.id,
            title: CourtCase.title,
            description: CourtCase.description,
          })
          .from(CourtCase)
          .where(eq(CourtCase.id, s.contentId))
          .limit(1);
        return row
          ? { ...row, type: "court_case" as const, savedAt: s.createdAt }
          : null;
      }),
    );

    return results.filter(Boolean);
  }),

  saveArticle: protectedProcedure
    .input(
      z.object({
        contentId: z.string().uuid(),
        contentType: z.enum(["bill", "government_content", "court_case"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .insert(SavedArticle)
        .values({
          userId,
          contentId: input.contentId,
          contentType: input.contentType,
        })
        .onConflictDoNothing();
      return { success: true };
    }),

  unsaveArticle: protectedProcedure
    .input(z.object({ contentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .delete(SavedArticle)
        .where(
          and(
            eq(SavedArticle.userId, userId),
            eq(SavedArticle.contentId, input.contentId),
          ),
        );
      return { success: true };
    }),

  isArticleSaved: protectedProcedure
    .input(z.object({ contentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [row] = await db
        .select({ id: SavedArticle.id })
        .from(SavedArticle)
        .where(
          and(
            eq(SavedArticle.userId, userId),
            eq(SavedArticle.contentId, input.contentId),
          ),
        )
        .limit(1);
      return { saved: !!row };
    }),

  // --- Feedback ---

  submitFeedback: protectedProcedure
    .input(
      z.object({
        category: z.enum(["bug", "idea", "content"]),
        message: z.string().min(1).max(5000),
        os: z.string().max(20).optional(),
        appVersion: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Dedup: skip if the same user submitted an identical message
      // within the last 60 seconds.
      const cutoff = new Date(Date.now() - 60_000);
      const [recent] = await db
        .select({ id: Feedback.id })
        .from(Feedback)
        .where(
          and(
            eq(Feedback.userId, userId),
            eq(Feedback.message, input.message),
            gte(Feedback.createdAt, cutoff),
          ),
        )
        .limit(1);
      if (recent) {
        return { success: true, deduped: true };
      }

      await db.insert(Feedback).values({
        userId,
        category: input.category,
        message: input.message,
        os: input.os,
        appVersion: input.appVersion,
      });
      return { success: true, deduped: false };
    }),

  // --- Data Export ---

  requestDataExport: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [profileRow] = await db
      .select({
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const [preferences] = await db
      .select()
      .from(UserPreference)
      .where(eq(UserPreference.userId, userId))
      .limit(1);

    const [settings] = await db
      .select()
      .from(UserSettings)
      .where(eq(UserSettings.userId, userId))
      .limit(1);

    const blocked = await db
      .select()
      .from(BlockedContent)
      .where(eq(BlockedContent.userId, userId));

    const savedArticles = await db
      .select()
      .from(SavedArticle)
      .where(eq(SavedArticle.userId, userId));

    const feedback = await db
      .select()
      .from(Feedback)
      .where(eq(Feedback.userId, userId));

    return {
      exportedAt: new Date().toISOString(),
      profile: profileRow ?? null,
      preferences: preferences ?? null,
      settings: settings ?? null,
      blocked,
      savedArticles,
      feedback,
    };
  }),
} satisfies TRPCRouterRecord;
