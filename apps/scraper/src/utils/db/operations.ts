import { db } from "@acme/db/client";
import { eq } from "@acme/db";
import { Bill, GovernmentContent, CourtCase } from "@acme/db/schema";
import type {
  BillData,
  GovernmentContentData,
  CourtCaseData,
} from "../types.js";
import { createContentHash } from "../hash.js";
import {
  generateAISummary,
  generateAIArticle,
  AIRateLimitError,
} from "../ai/text-generation.js";
import { generateImageSearchKeywords } from "../ai/image-keywords.js";
import { getThumbnailImage } from "../api/google-images.js";
import {
  checkExistingBill,
  checkExistingGovernmentContent,
  checkExistingCourtCase,
} from "./helpers.js";
import {
  incrementTotalProcessed,
  incrementNewEntries,
  incrementExistingUnchanged,
  incrementExistingChanged,
  incrementAIArticlesGenerated,
  incrementImagesSearched,
} from "./metrics.js";
import { generateVideoForContent } from "./video-operations.js";
import { createLogger } from "../log.js";

const logger = createLogger("db");

function isUsableText(text: string | undefined | null): text is string {
  if (!text || text.length < 200) return false;
  if (/[A-Z]:\\/.test(text)) return false;

  const lines = text.split("\n");
  const boilerplateLines = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed === "" ||
      trimmed.split(/\s+/).length === 1 ||
      (/[a-zA-Z]/.test(trimmed) &&
        trimmed === trimmed.toUpperCase() &&
        trimmed.length > 2)
    );
  });
  if (boilerplateLines.length / lines.length >= 0.3) return false;

  return true;
}

type ContentData =
  | { type: "bill"; data: BillData }
  | { type: "government_content"; data: GovernmentContentData }
  | { type: "court_case"; data: CourtCaseData };

function contentLabel(input: ContentData): string {
  switch (input.type) {
    case "bill":
      return `bill ${input.data.billNumber}`;
    case "government_content":
      return `${input.data.type} "${input.data.title}"`;
    case "court_case":
      return `court case ${input.data.caseNumber}`;
  }
}

function hashFields(input: ContentData): string {
  switch (input.type) {
    case "bill":
      return JSON.stringify({
        title: input.data.title,
        description: input.data.description,
        status: input.data.status,
        summary: input.data.summary,
        fullText: input.data.fullText,
      });
    case "government_content":
      return JSON.stringify({
        title: input.data.title,
        description: input.data.description,
        fullText: input.data.fullText,
      });
    case "court_case":
      return JSON.stringify({
        title: input.data.title,
        description: input.data.description,
        status: input.data.status,
        fullText: input.data.fullText,
      });
  }
}

async function checkExisting(input: ContentData) {
  switch (input.type) {
    case "bill":
      return checkExistingBill(input.data.billNumber, input.data.sourceWebsite);
    case "government_content":
      return checkExistingGovernmentContent(input.data.url);
    case "court_case":
      return checkExistingCourtCase(input.data.caseNumber);
  }
}

function getUpdateTable(input: ContentData) {
  switch (input.type) {
    case "bill":
      return { table: Bill, idCol: Bill.id };
    case "government_content":
      return { table: GovernmentContent, idCol: GovernmentContent.id };
    case "court_case":
      return { table: CourtCase, idCol: CourtCase.id };
  }
}

export async function upsertContent(input: ContentData) {
  const newContentHash = createContentHash(hashFields(input));
  const existing = await checkExisting(input);
  const label = contentLabel(input);

  incrementTotalProcessed();

  const fullText = input.data.fullText;
  const title = input.data.title;
  const url = input.data.url;

  const hasUsableText = isUsableText(fullText);
  let shouldGenerateArticle = false;
  let shouldGenerateImage = false;

  if (!existing) {
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = hasUsableText;
    incrementNewEntries();
    logger.info(`New ${label} detected`);
  } else if (existing.contentHash !== newContentHash) {
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingChanged();
    logger.info(`Content changed for ${label}`);
  } else {
    shouldGenerateArticle = false;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingUnchanged();
    logger.debug(`No changes for ${label}, skipping AI generation`);
  }

  // Phase 1: always persist raw content first (no AI fields)
  let result: { id: string; thumbnailUrl: string | null } | undefined;

  if (input.type === "bill") {
    const d = input.data;
    const [row] = await db
      .insert(Bill)
      .values({
        ...d,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: [Bill.billNumber, Bill.sourceWebsite],
        set: {
          title: d.title,
          description: d.description,
          sponsor: d.sponsor,
          status: d.status,
          introducedDate: d.introducedDate,
          congress: d.congress,
          chamber: d.chamber,
          summary: d.summary,
          fullText: d.fullText,
          url: d.url,
          contentHash: newContentHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    result = row;
  } else if (input.type === "government_content") {
    const d = input.data;
    const [row] = await db
      .insert(GovernmentContent)
      .values({
        ...d,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: GovernmentContent.url,
        set: {
          title: d.title,
          type: d.type,
          publishedDate: d.publishedDate,
          description: d.description,
          fullText: d.fullText,
          source: d.source,
          contentHash: newContentHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    result = row;
  } else {
    const d = input.data;
    const [row] = await db
      .insert(CourtCase)
      .values({
        ...d,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: CourtCase.caseNumber,
        set: {
          title: d.title,
          court: d.court,
          filedDate: d.filedDate,
          description: d.description,
          status: d.status,
          fullText: d.fullText,
          url: d.url,
          contentHash: newContentHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    result = row;
  }

  logger.debug(`${label} upserted (raw)`);

  if (!result) return result;

  // Phase 2: AI enrichment — skipped entirely if rate-limited
  try {
    const existingDescription = input.data.description;
    const articleType =
      input.type === "bill"
        ? "bill"
        : input.type === "government_content"
          ? input.data.type
          : "court case";

    const [description, aiGeneratedArticle, thumbnailUrl] = await Promise.all([
      // Summary generation
      (async (): Promise<string | undefined> => {
        if (existingDescription) {
          return existingDescription;
        } else if (
          shouldGenerateArticle &&
          (fullText || (input.type === "bill" && input.data.summary))
        ) {
          const summarySource =
            input.type === "bill"
              ? input.data.summary || input.data.fullText || ""
              : fullText!;
          logger.start(`Generating AI summary for ${label}`);
          return generateAISummary(title, summarySource);
        }
        return undefined;
      })(),

      // Article generation
      (async (): Promise<string | undefined> => {
        if (shouldGenerateArticle && hasUsableText) {
          logger.start(`Generating AI article for ${label}`);
          const article = await generateAIArticle(
            title,
            fullText!,
            articleType,
            url,
          );
          incrementAIArticlesGenerated();
          return article;
        } else if (existing?.hasArticle) {
          logger.debug(`Using existing AI article for ${label}`);
        }
        return undefined;
      })(),

      // Thumbnail image search
      (async (): Promise<string | null | undefined> => {
        if (shouldGenerateImage) {
          try {
            logger.start(`Searching for thumbnail for ${label}`);
            const searchQuery = await generateImageSearchKeywords(
              title,
              fullText || "",
              articleType,
            );
            logger.debug(`Image search query: ${searchQuery}`);
            const thumbnailResult = await getThumbnailImage(searchQuery);
            incrementImagesSearched();
            return thumbnailResult;
          } catch (error) {
            if (error instanceof AIRateLimitError) throw error;
            logger.warn(`Failed to fetch thumbnail for ${label}: ${error instanceof Error ? error.message : error}`);
            return null;
          }
        } else if (existing?.hasThumbnail) {
          logger.debug(`Using existing thumbnail for ${label}`);
        }
        return undefined;
      })(),
    ]);

    // Only UPDATE if something was generated
    const hasNewDescription =
      description !== undefined && description !== existingDescription;
    if (
      hasNewDescription ||
      aiGeneratedArticle !== undefined ||
      thumbnailUrl !== undefined
    ) {
      const { table, idCol } = getUpdateTable(input);
      await db
        .update(table)
        .set({
          ...(hasNewDescription && { description }),
          ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
          ...(thumbnailUrl !== undefined && {
            thumbnailUrl: thumbnailUrl || undefined,
          }),
          updatedAt: new Date(),
        })
        .where(eq(idCol, result.id));
      logger.success(`${label} enriched with AI content`);
    }
  } catch (error) {
    if (error instanceof AIRateLimitError) {
      logger.warn(`AI rate limit hit — ${label} saved without AI content, will retry next run`);
    } else {
      throw error;
    }
  }

  if (fullText) {
    try {
      const videoSource =
        input.type === "bill"
          ? input.data.sourceWebsite
          : input.type === "government_content"
            ? (input.data.source ?? "whitehouse.gov")
            : input.data.court;
      await generateVideoForContent(
        input.type,
        result.id,
        title,
        fullText,
        newContentHash,
        videoSource,
        result.thumbnailUrl,
      );
    } catch (error) {
      if (error instanceof AIRateLimitError) {
        logger.warn(`AI rate limit hit — ${label} saved without video, will retry next run`);
      } else {
        throw error;
      }
    }
  }

  return result;
}
