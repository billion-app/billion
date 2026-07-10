import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, inArray, or } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  CourtCase,
  GovernmentContent,
  SavedArticle,
  Video,
} from "@acme/db/schema";

import { protectedProcedure, publicProcedure } from "../trpc";

const SAVED_CONTENT_TYPES = [
  "bill",
  "government_content",
  "court_case",
] as const;
type SavedContentType = (typeof SAVED_CONTENT_TYPES)[number];

interface ContentImageRef {
  id: string;
  type: SavedContentType | "general";
  thumbnailUrl?: string;
}

interface VideoImage {
  imageUri?: string;
  thumbnailUrl?: string;
}

function videoImageUri(
  imageData: Buffer | null,
  imageMimeType: string | null,
): string | undefined {
  if (!imageData || !imageMimeType) return undefined;
  return `data:${imageMimeType};base64,${imageData.toString("base64")}`;
}

async function loadVideoImages(
  refs: readonly ContentImageRef[],
): Promise<Map<string, VideoImage>> {
  const conditions = SAVED_CONTENT_TYPES.flatMap((type) => {
    const ids = refs.filter((ref) => ref.type === type).map((ref) => ref.id);
    return ids.length > 0
      ? [and(eq(Video.contentType, type), inArray(Video.contentId, ids))]
      : [];
  });
  if (conditions.length === 0) return new Map();

  const videos = await db
    .select({
      contentType: Video.contentType,
      contentId: Video.contentId,
      imageData: Video.imageData,
      imageMimeType: Video.imageMimeType,
      thumbnailUrl: Video.thumbnailUrl,
    })
    .from(Video)
    .where(or(...conditions));

  return new Map(
    videos.map((video) => [
      `${video.contentType}:${video.contentId}`,
      {
        imageUri: videoImageUri(video.imageData, video.imageMimeType),
        thumbnailUrl: video.thumbnailUrl ?? undefined,
      },
    ]),
  );
}

async function attachVideoImages<T extends ContentImageRef>(
  items: readonly T[],
): Promise<(T & { imageUri?: string })[]> {
  const videoImages = await loadVideoImages(items);
  return items.map((item) => {
    const video = videoImages.get(`${item.type}:${item.id}`);
    const thumbnailUrl = item.thumbnailUrl ?? video?.thumbnailUrl;
    return {
      ...item,
      thumbnailUrl,
      // Source thumbnails remain preferred. Use the generated JPEG only when
      // the source content has no usable URL of its own.
      imageUri: thumbnailUrl ? undefined : video?.imageUri,
    };
  });
}

// Helper function to get thumbnail URL for any content
export async function getThumbnailForContent(
  id: string,
  type: "bill" | "court_case" | "government_content" | "general",
): Promise<string | null> {
  try {
    let thumbnailUrl: string | null = null;
    if (type === "bill") {
      const result = await db
        .select({ thumbnailUrl: Bill.thumbnailUrl })
        .from(Bill)
        .where(eq(Bill.id, id))
        .limit(1);
      thumbnailUrl = result[0]?.thumbnailUrl ?? null;
    } else if (type === "court_case") {
      const result = await db
        .select({ thumbnailUrl: CourtCase.thumbnailUrl })
        .from(CourtCase)
        .where(eq(CourtCase.id, id))
        .limit(1);
      thumbnailUrl = result[0]?.thumbnailUrl ?? null;
    } else {
      const result = await db
        .select({ thumbnailUrl: GovernmentContent.thumbnailUrl })
        .from(GovernmentContent)
        .where(eq(GovernmentContent.id, id))
        .limit(1);
      thumbnailUrl = result[0]?.thumbnailUrl ?? null;
    }
    if (thumbnailUrl || type === "general") return thumbnailUrl;

    const [video] = await db
      .select({
        imageData: Video.imageData,
        imageMimeType: Video.imageMimeType,
        thumbnailUrl: Video.thumbnailUrl,
      })
      .from(Video)
      .where(and(eq(Video.contentType, type), eq(Video.contentId, id)))
      .limit(1);
    return (
      videoImageUri(video?.imageData ?? null, video?.imageMimeType ?? null) ??
      video?.thumbnailUrl ??
      null
    );
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

    return attachVideoImages(allContent);
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

        return attachVideoImages(allContent);
      }

      if (input.type === "bill") {
        const bills = await db
          .select()
          .from(Bill)
          .orderBy(desc(Bill.createdAt))
          .limit(50);
        const items: ContentCard[] = bills.map((bill) => ({
          id: bill.id,
          title: bill.title,
          description: bill.description ?? bill.summary ?? "",
          type: "bill" as const,
          isAIGenerated: false,
          thumbnailUrl: bill.thumbnailUrl ?? undefined,
        }));
        return attachVideoImages(items);
      }

      if (input.type === "government_content" || input.type === "general") {
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .orderBy(desc(GovernmentContent.createdAt))
          .limit(50);
        const items: ContentCard[] = governmentContent.map((content) => ({
          id: content.id,
          title: content.title,
          description: content.description ?? "",
          type: "government_content" as const,
          isAIGenerated: false,
          thumbnailUrl: content.thumbnailUrl ?? undefined,
        }));
        return attachVideoImages(items);
      }

      // input.type === "court_case" — only remaining branch
      const courtCases = await db
        .select()
        .from(CourtCase)
        .orderBy(desc(CourtCase.createdAt))
        .limit(50);
      const items: ContentCard[] = courtCases.map((courtCase) => ({
        id: courtCase.id,
        title: courtCase.title,
        description: courtCase.description ?? "",
        type: "court_case" as const,
        isAIGenerated: false,
        thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
      }));
      return attachVideoImages(items);
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
        const [result] = await attachVideoImages([
          {
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
          },
        ]);
        if (!result) throw new Error(`Failed to decorate bill ${b.id}`);
        return result;
      }

      // Try to find in government content
      const content = await db
        .select()
        .from(GovernmentContent)
        .where(eq(GovernmentContent.id, input.id))
        .limit(1);
      if (content[0]) {
        const c = content[0];
        const [result] = await attachVideoImages([
          {
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
          },
        ]);
        if (!result) {
          throw new Error(`Failed to decorate government content ${c.id}`);
        }
        return result;
      }

      // Try to find in court cases
      const courtCase = await db
        .select()
        .from(CourtCase)
        .where(eq(CourtCase.id, input.id))
        .limit(1);
      if (courtCase[0]) {
        const c = courtCase[0];
        const [result] = await attachVideoImages([
          {
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
          },
        ]);
        if (!result) throw new Error(`Failed to decorate court case ${c.id}`);
        return result;
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
          .orderBy(desc(SavedArticle.createdAt), desc(SavedArticle.id))
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
                  thumbnailUrl: Bill.thumbnailUrl,
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
                  thumbnailUrl: GovernmentContent.thumbnailUrl,
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
                thumbnailUrl: CourtCase.thumbnailUrl,
              })
              .from(CourtCase)
              .where(eq(CourtCase.id, s.contentId))
              .limit(1);
            return row
              ? { ...row, type: "court_case" as const, savedAt: s.createdAt }
              : null;
          }),
        );

        const items = results
          .filter((item) => item != null)
          .map((item) => ({
            ...item,
            description: item.description ?? "",
            thumbnailUrl: item.thumbnailUrl ?? undefined,
          }));
        return {
          items: await attachVideoImages(items),
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
