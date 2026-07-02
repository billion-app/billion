import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  CourtCase,
  GovernmentContent,
  SavedArticle,
} from "@acme/db/schema";

import { protectedProcedure, publicProcedure } from "../trpc";

const SAVED_CONTENT_TYPES = [
  "bill",
  "government_content",
  "court_case",
] as const;

// Helper function to get thumbnail URL for any content
export async function getThumbnailForContent(
  id: string,
  type: "bill" | "court_case" | "government_content" | "general",
): Promise<string | null> {
  try {
    if (type === "bill") {
      const result = await db
        .select({ thumbnailUrl: Bill.thumbnailUrl })
        .from(Bill)
        .where(eq(Bill.id, id))
        .limit(1);
      return result[0]?.thumbnailUrl ?? null;
    } else if (type === "court_case") {
      const result = await db
        .select({ thumbnailUrl: CourtCase.thumbnailUrl })
        .from(CourtCase)
        .where(eq(CourtCase.id, id))
        .limit(1);
      return result[0]?.thumbnailUrl ?? null;
    } else {
      const result = await db
        .select({ thumbnailUrl: GovernmentContent.thumbnailUrl })
        .from(GovernmentContent)
        .where(eq(GovernmentContent.id, id))
        .limit(1);
      return result[0]?.thumbnailUrl ?? null;
    }
  } catch (error) {
    console.error(`Error fetching thumbnail for ${type} ${id}:`, error);
    return null;
  }
}

// Schema for content card with hybrid image support
const ContentCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["bill", "government_content", "court_case", "general"]),
  isAIGenerated: z.boolean(),
  thumbnailUrl: z.string().optional(),
  imageUri: z.string().optional(), // Add support for AI-generated data URIs
});

export type ContentCard = z.infer<typeof ContentCardSchema>;

// Schema for detailed content
const _ContentDetailSchema = ContentCardSchema.extend({
  articleContent: z.string(),
  originalContent: z.string(),
  url: z.string().optional(), // URL to original source
});

export type ContentDetail = z.infer<typeof _ContentDetailSchema>;

export const contentRouter = {
  // Get all content from database
  getAll: publicProcedure.query(async () => {
    const bills = await db
      .select()
      .from(Bill)
      .orderBy(desc(Bill.createdAt))
      .limit(20);
    const governmentContent = await db
      .select()
      .from(GovernmentContent)
      .orderBy(desc(GovernmentContent.createdAt))
      .limit(20);
    const courtCases = await db
      .select()
      .from(CourtCase)
      .orderBy(desc(CourtCase.createdAt))
      .limit(20);

    const allContent: ContentCard[] = [
      // Bills from database
      ...bills.map((bill) => ({
        id: bill.id,
        title: bill.title,
        description: bill.description ?? bill.summary ?? "",
        type: "bill" as const,
        isAIGenerated: false,
        thumbnailUrl: bill.thumbnailUrl ?? undefined,
      })),
      // Government content (news articles, executive orders, etc.) from database
      ...governmentContent.map((content) => ({
        id: content.id,
        title: content.title,
        description: content.description ?? "",
        type: "government_content" as const,
        isAIGenerated: false,
        thumbnailUrl: content.thumbnailUrl ?? undefined,
      })),
      // Court cases from database
      ...courtCases.map((courtCase) => ({
        id: courtCase.id,
        title: courtCase.title,
        description: courtCase.description ?? "",
        type: "court_case" as const,
        isAIGenerated: false,
        thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
      })),
    ];

    return allContent;
  }),

  // Get content filtered by type from database
  getByType: publicProcedure
    .input(
      z.object({
        type: z
          .enum(["all", "bill", "government_content", "court_case", "general"])
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      if (!input.type || input.type === "all") {
        const bills = await db
          .select()
          .from(Bill)
          .orderBy(desc(Bill.createdAt))
          .limit(20);
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .orderBy(desc(GovernmentContent.createdAt))
          .limit(20);
        const courtCases = await db
          .select()
          .from(CourtCase)
          .orderBy(desc(CourtCase.createdAt))
          .limit(20);

        const allContent: ContentCard[] = [
          // Bills from database
          ...bills.map((bill) => ({
            id: bill.id,
            title: bill.title,
            description: bill.description ?? bill.summary ?? "",
            type: "bill" as const,
            isAIGenerated: false,
            thumbnailUrl: bill.thumbnailUrl ?? undefined,
          })),
          // Government content from database
          ...governmentContent.map((content) => ({
            id: content.id,
            title: content.title,
            description: content.description ?? "",
            type: "government_content" as const,
            isAIGenerated: false,
            thumbnailUrl: content.thumbnailUrl ?? undefined,
          })),
          // Court cases from database
          ...courtCases.map((courtCase) => ({
            id: courtCase.id,
            title: courtCase.title,
            description: courtCase.description ?? "",
            type: "court_case" as const,
            isAIGenerated: false,
            thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
          })),
        ];

        return allContent;
      }

      if (input.type === "bill") {
        const bills = await db
          .select()
          .from(Bill)
          .orderBy(desc(Bill.createdAt))
          .limit(50);
        return bills.map((bill) => ({
          id: bill.id,
          title: bill.title,
          description: bill.description ?? bill.summary ?? "",
          type: "bill" as const,
          isAIGenerated: false,
          thumbnailUrl: bill.thumbnailUrl ?? undefined,
        }));
      }

      if (input.type === "government_content" || input.type === "general") {
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .orderBy(desc(GovernmentContent.createdAt))
          .limit(50);
        return governmentContent.map((content) => ({
          id: content.id,
          title: content.title,
          description: content.description ?? "",
          type: "government_content" as const,
          isAIGenerated: false,
          thumbnailUrl: content.thumbnailUrl ?? undefined,
        }));
      }

      // input.type === "court_case" — only remaining branch
      const courtCases = await db
        .select()
        .from(CourtCase)
        .orderBy(desc(CourtCase.createdAt))
        .limit(50);
      return courtCases.map((courtCase) => ({
        id: courtCase.id,
        title: courtCase.title,
        description: courtCase.description ?? "",
        type: "court_case" as const,
        isAIGenerated: false,
        thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
      }));
    }),

  // Get detailed content by ID from database
  getById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      // Try to find in bills
      const bill = await db
        .select()
        .from(Bill)
        .where(eq(Bill.id, input.id))
        .limit(1);
      if (bill[0]) {
        const b = bill[0];
        return {
          id: b.id,
          title: b.title,
          description: b.description ?? b.summary ?? "",
          type: "bill" as const,
          isAIGenerated: !!b.aiGeneratedArticle,
          thumbnailUrl: b.thumbnailUrl ?? undefined,
          articleContent:
            b.aiGeneratedArticle ?? b.fullText ?? "No content available",
          originalContent: b.fullText ?? "Full text not available",
          url: b.url,
          actions: (b.actions ?? []) as {
            date: string;
            text: string;
            type?: string;
          }[],
          status: b.status ?? undefined,
        };
      }

      // Try to find in government content
      const content = await db
        .select()
        .from(GovernmentContent)
        .where(eq(GovernmentContent.id, input.id))
        .limit(1);
      if (content[0]) {
        const c = content[0];
        return {
          id: c.id,
          title: c.title,
          description: c.description ?? "",
          type: "government_content" as const,
          isAIGenerated: !!c.aiGeneratedArticle,
          thumbnailUrl: c.thumbnailUrl ?? undefined,
          articleContent:
            c.aiGeneratedArticle ?? c.fullText ?? "No content available",
          originalContent: c.fullText ?? "Full text not available",
          url: c.url,
        };
      }

      // Try to find in court cases
      const courtCase = await db
        .select()
        .from(CourtCase)
        .where(eq(CourtCase.id, input.id))
        .limit(1);
      if (courtCase[0]) {
        const c = courtCase[0];
        return {
          id: c.id,
          title: c.title,
          description: c.description ?? "",
          type: "court_case" as const,
          isAIGenerated: !!c.aiGeneratedArticle,
          thumbnailUrl: c.thumbnailUrl ?? undefined,
          articleContent:
            c.aiGeneratedArticle ?? c.fullText ?? "No content available",
          originalContent: c.fullText ?? "Full text not available",
          url: c.url,
        };
      }

      throw new Error(`Content with id ${input.id} not found`);
    }),

  // --- Saved Articles ---
  saved: {
    // Paginated list of the current user's saved articles, newest first.
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(50).default(10),
          cursor: z.number().int().min(0).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const { limit, cursor = 0 } = input;

        const saved = await db
          .select()
          .from(SavedArticle)
          .where(eq(SavedArticle.userId, userId))
          .orderBy(desc(SavedArticle.createdAt))
          .limit(limit + 1)
          .offset(cursor);

        const hasMore = saved.length > limit;
        const page = hasMore ? saved.slice(0, limit) : saved;

        const results = await Promise.all(
          page.map(async (s) => {
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

        return {
          items: results.filter((item) => item != null),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }),

    // Save an article for the current user (no-op if already saved).
    add: protectedProcedure
      .input(
        z.object({
          contentId: z.string().uuid(),
          contentType: z.enum(SAVED_CONTENT_TYPES),
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

    // Remove a saved article for the current user.
    remove: protectedProcedure
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

    // Whether the given content is already saved by the current user.
    isSaved: protectedProcedure
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
  },
} satisfies TRPCRouterRecord;
