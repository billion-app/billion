import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CourtCase, GovernmentContent, Video } from "@acme/db/schema";

import { publicProcedure } from "../trpc";

// Schema for video/feed post (from Video table) - Hybrid image support
export const VideoPostSchema = z.object({
  id: z.string(),
  title: z.string().max(100),
  description: z.string(),
  author: z.string(),
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  type: z.enum(["bill", "government_content", "court_case", "general"]),
  articlePreview: z.string(),
  // Hybrid image support - use whichever is available
  imageUri: z.string().optional(), // Data URI from Video.imageData (AI-generated)
  thumbnailUrl: z.string().optional(), // URL from source content (scraped)
  originalContentId: z.string(), // Reference to source content
  sourceUrl: z.string().optional(), // Official source site
  createdAt: z.date(),
});

export type VideoPost = z.infer<typeof VideoPostSchema>;
export const videoRouter = {
  // Get videos with cursor-based pagination for infinite scroll
  getInfinite: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        cursor: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { limit, cursor = 0 } = input;

      // Query Video table instead of source tables
      const videos = await db
        .select()
        .from(Video)
        .orderBy(desc(Video.createdAt))
        .limit(limit)
        .offset(cursor);

      const billIds = videos
        .filter((video) => video.contentType === "bill")
        .map((video) => video.contentId);
      const governmentContentIds = videos
        .filter((video) => video.contentType === "government_content")
        .map((video) => video.contentId);
      const courtCaseIds = videos
        .filter((video) => video.contentType === "court_case")
        .map((video) => video.contentId);

      const [bills, governmentContent, courtCases] = await Promise.all([
        billIds.length
          ? db
              .select({ id: Bill.id, url: Bill.url })
              .from(Bill)
              .where(inArray(Bill.id, billIds))
          : [],
        governmentContentIds.length
          ? db
              .select({ id: GovernmentContent.id, url: GovernmentContent.url })
              .from(GovernmentContent)
              .where(inArray(GovernmentContent.id, governmentContentIds))
          : [],
        courtCaseIds.length
          ? db
              .select({ id: CourtCase.id, url: CourtCase.url })
              .from(CourtCase)
              .where(inArray(CourtCase.id, courtCaseIds))
          : [],
      ]);
      const sourceUrls = new Map(
        [...bills, ...governmentContent, ...courtCases].map(({ id, url }) => [
          id,
          url,
        ]),
      );

      // Transform to feed format with hybrid image support
      const feedPosts = videos.map((video) => {
        // Handle AI-generated binary images (convert to data URI)
        let imageUri: string | undefined;
        if (video.imageData && video.imageMimeType) {
          const base64 = video.imageData.toString("base64");
          imageUri = `data:${video.imageMimeType};base64,${base64}`;
        }

        const metrics = video.engagementMetrics as {
          likes: number;
          comments: number;
          shares: number;
        };

        // Map contentType to the enum values expected by frontend
        let type: "bill" | "government_content" | "court_case" | "general" =
          "general";
        if (
          video.contentType === "bill" ||
          video.contentType === "government_content" ||
          video.contentType === "court_case"
        ) {
          type = video.contentType;
        }

        return {
          id: video.id,
          title: video.title,
          description: video.description,
          author: video.author ?? "Unknown",
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          type,
          articlePreview: video.description, // Marketing description as preview
          imageUri, // AI-generated data URI (if exists)
          thumbnailUrl: video.thumbnailUrl ?? undefined, // URL-based thumbnail (if exists)
          originalContentId: video.contentId, // For "Read Full Article" navigation
          sourceUrl: sourceUrls.get(video.contentId),
          createdAt: video.createdAt,
        };
      });

      return {
        videos: feedPosts,
        nextCursor: cursor + limit,
      };
    }),
} satisfies TRPCRouterRecord;
