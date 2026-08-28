import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { JURISDICTION_CODES, JURISDICTIONS } from "../lib/content-jurisdiction";
import { publicProcedure } from "../trpc";

/**
 * Kept as a compatibility type for installed app versions while the feed is
 * disabled. The API returns an empty page and no longer reads a video table.
 */
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
  imageUri: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  originalContentId: z.string(),
  sourceUrl: z.string().optional(),
  jurisdiction: z.enum(JURISDICTIONS).optional(),
  jurisdictionCode: z.enum(JURISDICTION_CODES).optional(),
  contentLabel: z.string().optional(),
  sourceLabel: z.string().optional(),
  activityAt: z.date().optional(),
  createdAt: z.date(),
});

export type VideoPost = z.infer<typeof VideoPostSchema>;

export const videoRouter = {
  getInfinite: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        cursor: z.number().optional(),
      }),
    )
    .query(() => ({ videos: [] as VideoPost[], nextCursor: undefined })),
} satisfies TRPCRouterRecord;
