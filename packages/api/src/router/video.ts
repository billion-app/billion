import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { resolveContentImageUrl } from "@acme/db/content-images";
import { Video } from "@acme/db/schema";

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
  imageUri: z.string().optional(), // Stable source, Storage, or legacy HTTP URL
  imageFallbackUri: z.string().optional(),
  thumbnailUrl: z.string().optional(), // URL from source content (scraped)
  originalContentId: z.string(), // Reference to source content
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
        .select({
          id: Video.id,
          title: Video.title,
          description: Video.description,
          author: Video.author,
          engagementMetrics: Video.engagementMetrics,
          contentType: Video.contentType,
          contentId: Video.contentId,
          thumbnailUrl: Video.thumbnailUrl,
          generatedImagePath: Video.generatedImagePath,
          hasLegacyImage: sql<boolean>`${Video.imageData} is not null`,
        })
        .from(Video)
        .orderBy(desc(Video.createdAt))
        .limit(limit)
        .offset(cursor);

      // Transform to feed format with hybrid image support
      const feedPosts = videos.map((video) => {
        const imageUri = resolveContentImageUrl({
          sourceThumbnailUrl: video.thumbnailUrl,
          generatedImagePath: video.generatedImagePath,
          legacyImageUrl: video.hasLegacyImage
            ? `/api/content-images/legacy/${video.id}`
            : undefined,
        });
        const imageFallbackUri = video.thumbnailUrl
          ? resolveContentImageUrl({
              generatedImagePath: video.generatedImagePath,
              legacyImageUrl: video.hasLegacyImage
                ? `/api/content-images/legacy/${video.id}`
                : undefined,
            })
          : undefined;

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
          imageUri,
          imageFallbackUri,
          thumbnailUrl: video.thumbnailUrl ?? undefined,
          originalContentId: video.contentId, // For "Read Full Article" navigation
        };
      });

      return {
        videos: feedPosts,
        nextCursor: cursor + limit,
      };
    }),
} satisfies TRPCRouterRecord;
