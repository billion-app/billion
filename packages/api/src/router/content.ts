import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, inArray, or, sql, unionAll } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentLens,
  CourtCase,
  GovernmentContent,
  SavedArticle,
  Video,
} from "@acme/db/schema";

import { parseBillSponsor, sponsorRole } from "../lib/bill-sponsor";
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

// Look up cached dual-lens perspectives for a content item. Returns null when
// none have been generated yet (the client falls back to a placeholder).
async function getLensData(
  contentId: string,
  contentType: "bill" | "government_content" | "court_case",
) {
  const [lens] = await db
    .select({ lensData: ContentLens.lensData })
    .from(ContentLens)
    .where(
      and(
        eq(ContentLens.contentId, contentId),
        eq(ContentLens.contentType, contentType),
      ),
    )
    .limit(1);
  return lens?.lensData ?? null;
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
  billNumber: z.string().optional(), // Human-readable bill identifier, e.g. "H.R. 1234"
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
        billNumber: bill.billNumber,
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

  // Get content filtered by type from database, paginated for infinite scroll.
  getByType: publicProcedure
    .input(
      z.object({
        type: z
          .enum(["all", "bill", "government_content", "court_case", "general"])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.number().int().min(0).optional(),
      }),
    )
    .query(async ({ input }) => {
      const { limit } = input;
      const cursor = input.cursor ?? 0;

      if (!input.type || input.type === "all") {
        // Merge all three source tables into one chronological feed at the
        // database level (rather than concatenating fixed-size blocks) so
        // pagination advances correctly across types.
        const rows = await unionAll(
          db
            .select({
              id: Bill.id,
              title: Bill.title,
              description: sql<string>`coalesce(${Bill.description}, ${Bill.summary}, '')`,
              type: sql<string>`'bill'`,
              thumbnailUrl: Bill.thumbnailUrl,
              billNumber: sql<string | null>`${Bill.billNumber}`,
              createdAt: Bill.createdAt,
            })
            .from(Bill),
          db
            .select({
              id: GovernmentContent.id,
              title: GovernmentContent.title,
              description: sql<string>`coalesce(${GovernmentContent.description}, '')`,
              type: sql<string>`'government_content'`,
              thumbnailUrl: GovernmentContent.thumbnailUrl,
              billNumber: sql<string | null>`null`,
              createdAt: GovernmentContent.createdAt,
            })
            .from(GovernmentContent),
          db
            .select({
              id: CourtCase.id,
              title: CourtCase.title,
              description: sql<string>`coalesce(${CourtCase.description}, '')`,
              type: sql<string>`'court_case'`,
              thumbnailUrl: CourtCase.thumbnailUrl,
              billNumber: sql<string | null>`null`,
              createdAt: CourtCase.createdAt,
            })
            .from(CourtCase),
        )
          .orderBy(sql`"created_at" desc`)
          .limit(limit + 1)
          .offset(cursor);

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;

        const items: ContentCard[] = page.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          type: row.type as ContentCard["type"],
          isAIGenerated: false,
          thumbnailUrl: row.thumbnailUrl ?? undefined,
          billNumber: row.billNumber ?? undefined,
        }));

        return {
          items: await attachVideoImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }

      if (input.type === "bill") {
        const bills = await db
          .select()
          .from(Bill)
          .orderBy(desc(Bill.createdAt))
          .limit(limit + 1)
          .offset(cursor);
        const hasMore = bills.length > limit;
        const page = hasMore ? bills.slice(0, limit) : bills;
        const items: ContentCard[] = page.map((bill) => ({
          id: bill.id,
          title: bill.title,
          description: bill.description ?? bill.summary ?? "",
          type: "bill" as const,
          isAIGenerated: false,
          thumbnailUrl: bill.thumbnailUrl ?? undefined,
          billNumber: bill.billNumber,
        }));
        return {
          items: await attachVideoImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }

      if (input.type === "government_content" || input.type === "general") {
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .orderBy(desc(GovernmentContent.createdAt))
          .limit(limit + 1)
          .offset(cursor);
        const hasMore = governmentContent.length > limit;
        const page = hasMore
          ? governmentContent.slice(0, limit)
          : governmentContent;
        const items: ContentCard[] = page.map((content) => ({
          id: content.id,
          title: content.title,
          description: content.description ?? "",
          type: "government_content" as const,
          isAIGenerated: false,
          thumbnailUrl: content.thumbnailUrl ?? undefined,
        }));
        return {
          items: await attachVideoImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }

      // input.type === "court_case" — only remaining branch
      const courtCases = await db
        .select()
        .from(CourtCase)
        .orderBy(desc(CourtCase.createdAt))
        .limit(limit + 1)
        .offset(cursor);
      const hasMore = courtCases.length > limit;
      const page = hasMore ? courtCases.slice(0, limit) : courtCases;
      const items: ContentCard[] = page.map((courtCase) => ({
        id: courtCase.id,
        title: courtCase.title,
        description: courtCase.description ?? "",
        type: "court_case" as const,
        isAIGenerated: false,
        thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
      }));
      return {
        items: await attachVideoImages(items),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Full-text search across bills, government content, and court cases.
  // Matches against the generated `search_vector` tsvector column (title,
  // summary/description, full text) and, for bill/case numbers, a pg_trgm
  // trigram similarity match so loose codes like "hr1234" still find
  // "H.R. 1234".
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        type: z
          .enum(["all", "bill", "government_content", "court_case", "general"])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const { limit, query } = input;
      const type = input.type ?? "all";
      const tsQuery = sql`websearch_to_tsquery('english', ${query})`;

      const billRank = sql<number>`greatest(
        ts_rank_cd(${Bill.searchVector}, ${tsQuery}),
        similarity(${Bill.billNumber}, ${query})
      )`;
      const billMatch = sql`(
        ${Bill.searchVector} @@ ${tsQuery} or ${Bill.billNumber} % ${query}
      )`;

      const govRank = sql<number>`ts_rank_cd(${GovernmentContent.searchVector}, ${tsQuery})`;
      const govMatch = sql`${GovernmentContent.searchVector} @@ ${tsQuery}`;

      const caseRank = sql<number>`greatest(
        ts_rank_cd(${CourtCase.searchVector}, ${tsQuery}),
        similarity(${CourtCase.caseNumber}, ${query})
      )`;
      const caseMatch = sql`(
        ${CourtCase.searchVector} @@ ${tsQuery} or ${CourtCase.caseNumber} % ${query}
      )`;

      if (type === "bill") {
        const bills = await db
          .select()
          .from(Bill)
          .where(billMatch)
          .orderBy(desc(billRank))
          .limit(limit);
        const items: ContentCard[] = bills.map((bill) => ({
          id: bill.id,
          title: bill.title,
          description: bill.description ?? bill.summary ?? "",
          type: "bill" as const,
          isAIGenerated: false,
          thumbnailUrl: bill.thumbnailUrl ?? undefined,
          billNumber: bill.billNumber,
        }));
        return attachVideoImages(items);
      }

      if (type === "government_content" || type === "general") {
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .where(govMatch)
          .orderBy(desc(govRank))
          .limit(limit);
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

      if (type === "court_case") {
        const courtCases = await db
          .select()
          .from(CourtCase)
          .where(caseMatch)
          .orderBy(desc(caseRank))
          .limit(limit);
        const items: ContentCard[] = courtCases.map((courtCase) => ({
          id: courtCase.id,
          title: courtCase.title,
          description: courtCase.description ?? "",
          type: "court_case" as const,
          isAIGenerated: false,
          thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
        }));
        return attachVideoImages(items);
      }

      // "all" — union matches from all three tables, re-ranked together.
      // Postgres derives a UNION's output column names from the first
      // branch's select list, so the raw sql expressions below need an
      // explicit `.as(...)` alias for the outer ORDER BY to reference them.
      const rows = await unionAll(
        db
          .select({
            id: Bill.id,
            title: Bill.title,
            description:
              sql<string>`coalesce(${Bill.description}, ${Bill.summary}, '')`.as(
                "description",
              ),
            type: sql<string>`'bill'`.as("type"),
            thumbnailUrl: Bill.thumbnailUrl,
            billNumber: sql<string | null>`${Bill.billNumber}`,
            rank: billRank.as("rank"),
          })
          .from(Bill)
          .where(billMatch),
        db
          .select({
            id: GovernmentContent.id,
            title: GovernmentContent.title,
            description:
              sql<string>`coalesce(${GovernmentContent.description}, '')`.as(
                "description",
              ),
            type: sql<string>`'government_content'`.as("type"),
            thumbnailUrl: GovernmentContent.thumbnailUrl,
            billNumber: sql<string | null>`null`,
            rank: govRank.as("rank"),
          })
          .from(GovernmentContent)
          .where(govMatch),
        db
          .select({
            id: CourtCase.id,
            title: CourtCase.title,
            description: sql<string>`coalesce(${CourtCase.description}, '')`.as(
              "description",
            ),
            type: sql<string>`'court_case'`.as("type"),
            thumbnailUrl: CourtCase.thumbnailUrl,
            billNumber: sql<string | null>`null`,
            rank: caseRank.as("rank"),
          })
          .from(CourtCase)
          .where(caseMatch),
      )
        .orderBy(sql`"rank" desc`)
        .limit(limit);

      const items: ContentCard[] = rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type as ContentCard["type"],
        isAIGenerated: false,
        thumbnailUrl: row.thumbnailUrl ?? undefined,
        billNumber: row.billNumber ?? undefined,
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
        const sponsor = b.sponsor
          ? {
              ...parseBillSponsor(b.sponsor),
              role: sponsorRole(b.chamber),
            }
          : undefined;
        const [result] = await attachVideoImages([
          {
            id: b.id,
            title: b.title,
            description: b.description ?? b.summary ?? "",
            type: "bill" as const,
            isAIGenerated: !!b.aiGeneratedArticle,
            thumbnailUrl: b.thumbnailUrl ?? undefined,
            billNumber: b.billNumber,
            sponsor,
            articleContent:
              b.aiGeneratedArticle ?? b.fullText ?? "No content available",
            originalContent: b.fullText ?? "Full text not available",
            url: b.url,
            actions: b.actions ?? [],
            status: b.status ?? undefined,
            lensData: await getLensData(b.id, "bill"),
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
            billNumber: undefined,
            articleContent:
              c.aiGeneratedArticle ?? c.fullText ?? "No content available",
            originalContent: c.fullText ?? "Full text not available",
            url: c.url,
            lensData: await getLensData(c.id, "government_content"),
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
            billNumber: undefined,
            articleContent:
              c.aiGeneratedArticle ?? c.fullText ?? "No content available",
            originalContent: c.fullText ?? "Full text not available",
            url: c.url,
            lensData: await getLensData(c.id, "court_case"),
          },
        ]);
        if (!result) throw new Error(`Failed to decorate court case ${c.id}`);
        return result;
      }

      throw new Error(`Content with id ${input.id} not found`);
    }),

  // Profile and related legislation for the member who formally sponsored a bill.
  getSponsorProfile: publicProcedure
    .input(z.object({ billId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [bill] = await db
        .select()
        .from(Bill)
        .where(eq(Bill.id, input.billId))
        .limit(1);

      if (!bill) throw new Error(`Bill with id ${input.billId} not found`);
      if (!bill.sponsor) return null;

      const sponsoredBills = await db
        .select({
          id: Bill.id,
          title: Bill.title,
          description: Bill.description,
          summary: Bill.summary,
          billNumber: Bill.billNumber,
          status: Bill.status,
          thumbnailUrl: Bill.thumbnailUrl,
          introducedDate: Bill.introducedDate,
        })
        .from(Bill)
        .where(eq(Bill.sponsor, bill.sponsor))
        .orderBy(desc(Bill.introducedDate), desc(Bill.createdAt))
        .limit(20);

      return {
        sponsor: {
          ...parseBillSponsor(bill.sponsor),
          role: sponsorRole(bill.chamber),
        },
        sourceUrl: bill.url,
        sponsoredBills: sponsoredBills.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description ?? item.summary ?? "",
          billNumber: item.billNumber,
          status: item.status ?? undefined,
          thumbnailUrl: item.thumbnailUrl ?? undefined,
          introducedDate: item.introducedDate?.toISOString(),
        })),
      };
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
                  billNumber: Bill.billNumber,
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
