import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CourtCase, GovernmentContent } from "@acme/db/schema";

import { publicProcedure } from "../trpc";

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
  imageUrl: z.string().optional(),
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
} satisfies TRPCRouterRecord;
