import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentLens,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import type { NewItemLimiter } from "../new-item-limit.js";
import type {
  BillData,
  CourtCaseData,
  GovernmentContentData,
} from "../types.js";
import { generateImageSearchKeywords } from "../ai/image-keywords.js";
import { getTextModelVersion } from "../ai/provider.js";
import {
  AIRateLimitError,
  framingForContentType,
  generateAIArticle,
  generateAISummary,
  generateDualLens,
} from "../ai/text-generation.js";
import { getThumbnailImage } from "../api/google-images.js";
import { createContentHash } from "../hash.js";
import { createLogger } from "../log.js";
import { tickProgress } from "../progress.js";
import { isUsableSourceText } from "../reprocessing-policy.js";
import {
  checkExistingBill,
  checkExistingCourtCase,
  checkExistingGovernmentContent,
} from "./helpers.js";
import {
  incrementAIArticlesGenerated,
  incrementExistingChanged,
  incrementExistingUnchanged,
  incrementImagesSearched,
  incrementNewEntries,
  incrementTotalProcessed,
} from "./metrics.js";
import { generateVideoForContent } from "./video-operations.js";

const logger = createLogger("db");
const forceAIRegeneration = process.env.SCRAPER_FORCE_AI_REGEN === "1";

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
        jurisdiction: input.data.jurisdiction,
        legislativeSession: input.data.legislativeSession,
        openStatesId: input.data.openStatesId,
        subjects: input.data.subjects,
        sponsorships: input.data.sponsorships,
        documents: input.data.documents,
        votes: input.data.votes,
        actions: input.data.actions,
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
      return checkExistingBill(
        input.data.billNumber,
        input.data.sourceWebsite,
        input.data.legislativeSession,
      );
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

export async function upsertContent(
  input: ContentData,
  options?: { newItemLimiter?: NewItemLimiter; skipEnrichment?: boolean },
) {
  const newContentHash = createContentHash(hashFields(input));
  const existing = await checkExisting(input);
  const label = contentLabel(input);

  incrementTotalProcessed();

  const fullText = input.data.fullText;
  const title = input.data.title;
  const url = input.data.url;
  const sourceDescription = input.data.description;

  const hasUsableText = isUsableSourceText(fullText);
  if (!hasUsableText && fullText) {
    logger.debug(
      `${label} fullText failed usability check (too short or boilerplate-heavy) — AI article will be skipped`,
    );
  }
  const hasSummarySource = Boolean(
    fullText || (input.type === "bill" && input.data.summary),
  );
  const persistedDescription = existing?.description;
  const hasPersistedSummary = Boolean(
    (sourceDescription && sourceDescription.trim()) ||
    (persistedDescription && persistedDescription.trim()),
  );
  let shouldGenerateSummary = false;
  let shouldGenerateArticle = false;
  let shouldGenerateImage = false;

  let progressKind: "new" | "changed" | "unchanged";
  if (!existing) {
    shouldGenerateSummary = !sourceDescription && hasSummarySource;
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = hasUsableText;
    progressKind = "new";
    logger.info(`New ${label} detected`);
  } else if (existing.contentHash !== newContentHash) {
    shouldGenerateSummary = forceAIRegeneration
      ? !sourceDescription && hasSummarySource
      : !hasPersistedSummary && !sourceDescription && hasSummarySource;
    shouldGenerateArticle = forceAIRegeneration
      ? hasUsableText
      : hasUsableText && !existing.hasArticle;
    shouldGenerateImage =
      (forceAIRegeneration || !existing.hasThumbnail) && hasUsableText;
    progressKind = "changed";
    logger.info(`Content changed for ${label}`);
  } else {
    shouldGenerateSummary = forceAIRegeneration
      ? !sourceDescription && hasSummarySource
      : !hasPersistedSummary && !sourceDescription && hasSummarySource;
    shouldGenerateArticle = forceAIRegeneration
      ? hasUsableText
      : hasUsableText && !existing.hasArticle;
    shouldGenerateImage =
      (forceAIRegeneration || !existing.hasThumbnail) && hasUsableText;
    progressKind = "unchanged";
    logger.debug(
      shouldGenerateSummary || shouldGenerateArticle || shouldGenerateImage
        ? `No raw changes for ${label}, backfilling missing AI content`
        : `No changes for ${label}, skipping AI generation`,
    );
  }

  // New items beyond the run's daily budget skip AI enrichment. Bills that
  // need a generated description are deferred before insertion; other content
  // can persist raw and look like "needs backfill" work next run.
  const budgetExhausted =
    progressKind === "new" &&
    options?.newItemLimiter !== undefined &&
    !options.newItemLimiter.tryConsume();
  if (budgetExhausted) {
    shouldGenerateSummary = false;
    shouldGenerateArticle = false;
    shouldGenerateImage = false;
    logger.info(
      `${label}: daily new-item cap reached, deferring AI enrichment to a later run`,
    );
  }

  // A generated bill description is part of the bill's minimum usable record,
  // not an optional derived asset. Generate it before the insert so provider
  // failure cannot leave a new, summarizable bill permanently blank.
  let preGeneratedDescription: string | undefined;
  if (!existing && input.type === "bill" && !sourceDescription) {
    if (budgetExhausted || !hasSummarySource) {
      logger.warn(
        `${label}: deferring insert until a summary can be generated`,
      );
      return undefined;
    }
    const summarySource = input.data.summary || input.data.fullText || "";
    logger.start(`Generating required AI summary for ${label}`);
    preGeneratedDescription = await generateAISummary(title, summarySource);
    if (!preGeneratedDescription.trim()) {
      throw new Error(`AI returned an empty required summary for ${label}`);
    }
    shouldGenerateSummary = false;
  }

  if (progressKind === "new") incrementNewEntries();
  else if (progressKind === "changed") incrementExistingChanged();
  else incrementExistingUnchanged();

  // Phase 1: persist source fields (plus the required pre-generated bill
  // description when applicable) before optional derived assets.
  let result: { id: string; thumbnailUrl: string | null } | undefined;

  if (input.type === "bill") {
    const d = input.data;
    const [row] = await db
      .insert(Bill)
      .values({
        ...d,
        description: preGeneratedDescription || d.description,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: [
          Bill.billNumber,
          Bill.sourceWebsite,
          Bill.legislativeSession,
        ],
        set: {
          title: d.title,
          description: d.description,
          sponsor: d.sponsor,
          status: d.status,
          introducedDate: d.introducedDate,
          congress: d.congress,
          chamber: d.chamber,
          jurisdiction: d.jurisdiction,
          legislativeSession: d.legislativeSession,
          openStatesId: d.openStatesId,
          subjects: d.subjects,
          sponsorships: d.sponsorships,
          documents: d.documents,
          votes: d.votes,
          summary: d.summary,
          fullText: d.fullText,
          actions: d.actions,
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

  if (!result) {
    tickProgress({
      newEntries: progressKind === "new" ? 1 : 0,
      unchanged: progressKind === "unchanged" ? 1 : 0,
      changed: progressKind === "changed" ? 1 : 0,
    });
    return result;
  }

  if (options?.skipEnrichment) {
    tickProgress({
      newEntries: progressKind === "new" ? 1 : 0,
      unchanged: progressKind === "unchanged" ? 1 : 0,
      changed: progressKind === "changed" ? 1 : 0,
    });
    return result;
  }

  // Phase 2: AI enrichment — skipped entirely if rate-limited
  try {
    const existingDescription = sourceDescription || persistedDescription;
    const effectiveDescription = preGeneratedDescription || existingDescription;
    const articleType =
      input.type === "bill"
        ? "bill"
        : input.type === "government_content"
          ? input.data.type
          : "court case";

    const [description, aiGeneratedArticle, thumbnailUrl] = await Promise.all([
      // Summary generation
      (async (): Promise<string | undefined> => {
        if (effectiveDescription) {
          return effectiveDescription;
        } else if (shouldGenerateSummary) {
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
          if (article) {
            incrementAIArticlesGenerated();
            return article;
          }
          logger.warn(
            `AI article generation returned empty result for ${label}`,
          );
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
            logger.warn(
              `Failed to fetch thumbnail for ${label}: ${error instanceof Error ? error.message : error}`,
            );
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
      description !== undefined && description !== effectiveDescription;
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

    // Generate and cache dual-lens perspectives
    if (hasUsableText && result?.id) {
      await upsertContentLens(
        result.id,
        input.type,
        newContentHash,
        title,
        fullText!,
        articleType,
      );
    }
  } catch (error) {
    if (error instanceof AIRateLimitError) {
      logger.warn(
        `AI rate limit hit — ${label} saved without AI content, will retry next run`,
      );
    } else {
      throw error;
    }
  }

  if (fullText && !budgetExhausted) {
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
        logger.warn(
          `AI rate limit hit — ${label} saved without video, will retry next run`,
        );
      } else {
        // Video generation is supplementary — a failure here must not abort
        // content processing or propagate the raw DB error (which can contain
        // binary image data) up to the scraper's generic error handler
        logger.warn(
          `Video generation failed for ${label} — content was saved successfully: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  tickProgress({
    newEntries: progressKind === "new" ? 1 : 0,
    unchanged: progressKind === "unchanged" ? 1 : 0,
    changed: progressKind === "changed" ? 1 : 0,
  });

  return result;
}

/**
 * Generate (or refresh) the cached dual-lens perspectives for a content item.
 * Skips generation when a row already exists for the current contentHash, so
 * unchanged content never re-pays for an LLM call. AIRateLimitError propagates
 * to the caller's rate-limit handler.
 */
export async function upsertContentLens(
  contentId: string,
  contentType: "bill" | "government_content" | "court_case",
  contentHash: string,
  title: string,
  fullText: string,
  articleType: string,
): Promise<void> {
  const [existing] = await db
    .select({ contentHash: ContentLens.contentHash })
    .from(ContentLens)
    .where(
      and(
        eq(ContentLens.contentId, contentId),
        eq(ContentLens.contentType, contentType),
      ),
    )
    .limit(1);

  if (existing?.contentHash === contentHash) {
    logger.debug(`Dual-lens already cached for ${contentId}`);
    return;
  }

  const lens = await generateDualLens(
    title,
    fullText,
    articleType,
    framingForContentType(contentType),
  );
  if (!lens) {
    logger.warn(`Dual-lens generation returned null for ${contentId}`);
    return;
  }

  const modelVersion = getTextModelVersion();
  await db
    .insert(ContentLens)
    .values({
      contentId,
      contentType,
      contentHash,
      lensData: {
        ...lens,
        generatedAt: new Date().toISOString(),
        modelVersion,
      },
      modelVersion,
    })
    .onConflictDoUpdate({
      target: [ContentLens.contentType, ContentLens.contentId],
      set: {
        contentHash,
        lensData: {
          ...lens,
          generatedAt: new Date().toISOString(),
          modelVersion,
        },
        modelVersion,
        updatedAt: new Date(),
      },
    });

  logger.success(`Cached dual-lens for ${contentId}`);
}
