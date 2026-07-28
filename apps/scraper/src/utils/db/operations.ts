import { randomUUID } from "node:crypto";

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentBrief,
  ContentLens,
  CourtCase,
  GovernmentContent,
  Video,
} from "@acme/db/schema";
import { isCurrentBillBrief } from "@acme/validators";

import type { BillSourceVersionInput } from "../bill-sections.js";
import type { NewItemLimiter } from "../new-item-limit.js";
import type {
  BillData,
  CourtCaseData,
  GovernmentContentData,
} from "../types.js";
import { generateBillBrief } from "../ai/bill-brief.js";
import { generateImageSearchKeywords } from "../ai/image-keywords.js";
import { getTextModelVersion } from "../ai/provider.js";
import {
  AIRateLimitError,
  buildDualLensGrounding,
  framingForContentType,
  generateAIArticle,
  generateAISummary,
  generateDualLens,
  isUsableDualLens,
} from "../ai/text-generation.js";
import { getThumbnailImage } from "../api/google-images.js";
import { clampBillDescription } from "../bill-description.js";
import { createContentHash } from "../hash.js";
import { createLogger } from "../log.js";
import { tickProgress } from "../progress.js";
import { isUsableSourceText } from "../reprocessing-policy.js";
import { persistBillSourceVersions } from "./bill-source-operations.js";
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
  incrementVideosGenerated,
} from "./metrics.js";
import type { BuiltVideoRecord, DbExecutor } from "./video-operations.js";
import {
  buildVideoRecord,
  generateVideoForContent,
  persistVideoRecord,
} from "./video-operations.js";

const logger = createLogger("db");
const forceAIRegeneration = process.env.SCRAPER_FORCE_AI_REGEN === "1";

type ContentData =
  | { type: "bill"; data: BillData }
  | { type: "government_content"; data: GovernmentContentData }
  | { type: "court_case"; data: CourtCaseData };

/**
 * What happened to one item, in terms the caller's cursor can act on.
 *
 * - `written`   — stored, and as complete as its sources allow.
 * - `skipped`   — deliberately not stored, and re-offering it would reach the
 *                 same conclusion. Safe for a cursor to move past.
 * - `deferred`  — not stored (or stored but not enriched), for a reason that
 *                 may not hold next time. A cursor MUST NOT move past it.
 *
 * The distinction exists because an incremental scraper only sees each item
 * once. Conflating "we decided against this" with "we could not finish this"
 * is what silently drops bills.
 */
export type UpsertOutcome =
  | { status: "written"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "deferred"; reason: string };

/**
 * Thrown when enrichment we committed to producing did not materialise, but
 * nothing threw — an AI call that returns an empty article, for instance.
 * Handled like any other enrichment failure so a new item is rolled back
 * rather than published half-built.
 */
class IncompleteEnrichmentError extends Error {}

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
      return checkExistingCourtCase(input.data.caseNumber, input.data.court);
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
  options?: {
    newItemLimiter?: NewItemLimiter;
    billSourceVersions?: readonly BillSourceVersionInput[];
  },
): Promise<UpsertOutcome> {
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

  // Bills are served from their structured brief, not from the long-form
  // article. `article-detail.tsx` renders the brief whenever one exists and
  // only falls back to `aiGeneratedArticle` (then to raw GPO text) when it does
  // not — which is exactly the unreadable state this change removes. Generating
  // both means paying for a wall of prose that nothing displays.
  //
  // The column and the `priorArticle` input stay: existing rows still hold
  // articles worth using as framing context, and court cases and executive
  // actions have no brief schema yet, so they still depend on it.
  const generatesArticle = input.type !== "bill";

  let progressKind: "new" | "changed" | "unchanged";
  if (!existing) {
    shouldGenerateSummary = !sourceDescription && hasSummarySource;
    shouldGenerateArticle = generatesArticle && hasUsableText;
    shouldGenerateImage = hasUsableText;
    progressKind = "new";
    logger.info(`New ${label} detected`);
  } else if (existing.contentHash !== newContentHash) {
    shouldGenerateSummary = forceAIRegeneration
      ? !sourceDescription && hasSummarySource
      : !hasPersistedSummary && !sourceDescription && hasSummarySource;
    shouldGenerateArticle =
      generatesArticle &&
      (forceAIRegeneration ? hasUsableText : hasUsableText && !existing.hasArticle);
    shouldGenerateImage =
      (forceAIRegeneration || !existing.hasThumbnail) && hasUsableText;
    progressKind = "changed";
    logger.info(`Content changed for ${label}`);
  } else {
    shouldGenerateSummary = forceAIRegeneration
      ? !sourceDescription && hasSummarySource
      : !hasPersistedSummary && !sourceDescription && hasSummarySource;
    shouldGenerateArticle =
      generatesArticle &&
      (forceAIRegeneration ? hasUsableText : hasUsableText && !existing.hasArticle);
    shouldGenerateImage =
      (forceAIRegeneration || !existing.hasThumbnail) && hasUsableText;
    progressKind = "unchanged";
    logger.debug(
      shouldGenerateSummary || shouldGenerateArticle || shouldGenerateImage
        ? `No raw changes for ${label}, backfilling missing AI content`
        : `No changes for ${label}, skipping AI generation`,
    );
  }

  // The run's budget is a cap on *items that generate*, not on new items.
  //
  // It used to be gated on `progressKind === "new"`, which left the far more
  // expensive case uncapped: an existing bill whose content changed, or which
  // is missing a derived asset, would regenerate its brief and its dual lens
  // with no limit at all. A backfill re-walking the archive therefore ignored
  // the budget almost entirely — every bill it passed took the "changed" path,
  // because its stored text was being corrected.
  //
  // One item draws at most one slot, and only when something is actually
  // generated. A genuinely unchanged item with every asset present costs
  // nothing and must not consume budget, or a run would throttle itself to N
  // items while doing no work.
  // Set when the item is stored but knowingly left short of what it should
  // have — always for a reason a later run can resolve.
  let deferredReason: string | undefined;

  let budgetSlotTaken = false;
  const claimBudget = (): boolean => {
    if (!options?.newItemLimiter) return true;
    if (budgetSlotTaken) return true;
    if (options.newItemLimiter.tryConsume()) {
      budgetSlotTaken = true;
      return true;
    }
    return false;
  };

  const wantsUpfrontGeneration =
    shouldGenerateSummary || shouldGenerateArticle || shouldGenerateImage;
  const budgetExhausted = wantsUpfrontGeneration && !claimBudget();
  if (budgetExhausted) {
    // An item we have never stored is held back entirely rather than written
    // raw. A raw row is a bill with no description, article, lens or brief in
    // front of readers, and reporting it as stored lets the cursor move past
    // it — so "enrich it on a later run" never happens. Not storing it costs
    // us the item until the next run and nothing more.
    if (!existing) {
      logger.info(
        `${label}: run budget reached before it could be enriched — not storing it, will retry next run`,
      );
      return { status: "deferred", reason: "run budget reached" };
    }
    // An item already in the database is a different case: refreshing its raw
    // fields is an improvement even when we cannot afford to regenerate its
    // derived assets. Do that, but still report the item as unfinished so the
    // cursor holds and the assets are picked up next run.
    shouldGenerateSummary = false;
    shouldGenerateArticle = false;
    shouldGenerateImage = false;
    deferredReason = "run budget reached";
    logger.info(
      `${label}: run budget reached, deferring AI enrichment to a later run`,
    );
  }

  // A generated bill description is part of the bill's minimum usable record,
  // not an optional derived asset. Generate it before the insert so provider
  // failure cannot leave a new, summarizable bill permanently blank.
  let preGeneratedDescription: string | undefined;
  if (!existing && input.type === "bill" && !sourceDescription) {
    if (!hasSummarySource) {
      // Permanent as far as this run can tell: congress.gov has published
      // neither text nor a CRS summary, so there is nothing to summarise and
      // nothing a retry would change until the bill itself is updated — which
      // moves its updateDate and re-offers it anyway.
      logger.warn(`${label}: no text or summary published yet, skipping`);
      return { status: "skipped", reason: "no summary source published" };
    }
    const summarySource = input.data.summary || input.data.fullText || "";
    logger.start(`Generating required AI summary for ${label}`);
    preGeneratedDescription = await generateAISummary(title, summarySource);
    if (!preGeneratedDescription.trim()) {
      throw new Error(`AI returned an empty required summary for ${label}`);
    }
    shouldGenerateSummary = false;
  }

  // A bill we have never stored is assembled completely before anything is
  // written. Everything below this point in the ordinary path writes the row
  // first and enriches afterwards, which leaves the bill visible — titled,
  // described, but with a grey placeholder where its header art belongs and raw
  // GPO text under "Plain explainer" — for the two to four minutes its assets
  // take to generate. For an existing bill that is the right trade, because the
  // row is already public and refreshing it in place only improves it. For a
  // new one it means publishing something unfinished, which is what this path
  // exists to prevent.
  //
  // The id is minted here rather than by the database so the brief and the
  // video can reference the bill before it exists, and all three rows land in
  // one transaction.
  if (!existing && input.type === "bill" && !budgetExhausted) {
    const assembled = await assembleNewBill({
      data: input.data,
      contentHash: newContentHash,
      description: preGeneratedDescription,
      label,
      claimBudget,
      billSourceVersions: options?.billSourceVersions,
    });

    if (assembled.status !== "ready") {
      // Nothing was written, so there is nothing to roll back. The bill keeps
      // its place in the feed and the next run tries the whole thing again.
      logger.warn(`${label}: ${assembled.reason} — not storing it this run`);
      tickProgress({ newEntries: 0, unchanged: 0, changed: 0 });
      return { status: "deferred", reason: assembled.reason };
    }

    incrementNewEntries();
    tickProgress({ newEntries: 1, unchanged: 0, changed: 0 });
    return { status: "written", id: assembled.id };
  }

  if (progressKind === "new") incrementNewEntries();
  else if (progressKind === "changed") incrementExistingChanged();
  else incrementExistingUnchanged();

  // Phase 1: persist source fields (plus the required pre-generated bill
  // description when applicable) before optional derived assets.
  let result: { id: string; thumbnailUrl: string | null } | undefined;

  if (input.type === "bill") {
    const d = input.data;
    const description = d.description
      ? clampBillDescription(d.description)
      : d.description;
    const [row] = await db
      .insert(Bill)
      .values({
        ...d,
        description: preGeneratedDescription || description,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: [Bill.billNumber, Bill.sourceWebsite],
        set: {
          title: d.title,
          description,
          sponsor: d.sponsor,
          status: d.status,
          introducedDate: d.introducedDate,
          congress: d.congress,
          chamber: d.chamber,
          summary: d.summary,
          fullText: d.fullText,
          url: d.url,
          contentHash: newContentHash,
          sourceUpdatedAt: d.sourceUpdatedAt,
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
        target: [CourtCase.caseNumber, CourtCase.court],
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

  if (input.type === "bill" && result && options?.billSourceVersions?.length) {
    await persistBillSourceVersions(result.id, options.billSourceVersions);
  }

  logger.debug(`${label} upserted (raw)`);

  if (!result) {
    tickProgress({
      newEntries: progressKind === "new" ? 1 : 0,
      unchanged: progressKind === "unchanged" ? 1 : 0,
      changed: progressKind === "changed" ? 1 : 0,
    });
    return { status: "deferred", reason: "upsert returned no row" };
  }

  const rowId = result.id;

  // Undo phase 1 for an item we had never stored before. The derived tables
  // hold plain uuids rather than foreign keys, so nothing cascades and each one
  // has to be cleared by hand — miss one and it orphans against a row that no
  // longer exists.
  const discardNewRow = async () => {
    const { table, idCol } = getUpdateTable(input);
    await db
      .delete(ContentLens)
      .where(
        and(
          eq(ContentLens.contentType, input.type),
          eq(ContentLens.contentId, rowId),
        ),
      );
    await db
      .delete(ContentBrief)
      .where(
        and(
          eq(ContentBrief.contentType, input.type),
          eq(ContentBrief.contentId, rowId),
        ),
      );
    await db
      .delete(Video)
      .where(
        and(eq(Video.contentType, input.type), eq(Video.contentId, rowId)),
      );
    await db.delete(table).where(eq(idCol, rowId));
  };

  // Phase 2: AI enrichment
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
          // For an item we are storing for the first time this is the whole
          // point of storing it, so treat an empty result as a failure rather
          // than shipping a bill with nothing to read. An item already in the
          // database keeps its old behaviour: it is no worse off than before.
          if (!existing) {
            throw new IncompleteEnrichmentError(
              `AI article generation returned an empty result for ${label}`,
            );
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

    // Generate and cache dual-lens perspectives. Past-budget items are skipped
    // along with every other derived asset: the lens runs an agentic research
    // loop, and it is the budget's whole purpose to not pay for that on a bill
    // we are only persisting raw. `retroactive-lenses` backfills them.
    if (hasUsableText && result?.id && !budgetExhausted) {
      await upsertContentLens(
        result.id,
        input.type,
        newContentHash,
        title,
        fullText!,
        articleType,
        aiGeneratedArticle,
        claimBudget,
      );
    }

    // Generate and cache the structured brief. Bills only for now — the brief
    // schema is written around legislative mechanics (before/after provisions,
    // sponsor-vs-text framing) and needs separate design work per content type.
    // Past-budget items defer to `retroactive-briefs`, as with the lens above.
    if (
      hasUsableText &&
      result?.id &&
      input.type === "bill" &&
      !budgetExhausted
    ) {
      await upsertBillBrief({
        contentId: result.id,
        contentHash: newContentHash,
        title,
        billNumber: input.data.billNumber,
        url,
        fullText: fullText!,
        officialSummary: input.data.summary,
        status: input.data.status,
        priorArticle: aiGeneratedArticle,
        claimBudget,
      });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // Nothing half-built survives a first store. Roll the row back and report
    // the item as unfinished so the caller's cursor holds and the next run
    // gets another attempt at the whole thing.
    if (!existing) {
      await discardNewRow();
      logger.warn(
        `${label}: enrichment did not complete (${detail}) — removed the partial row, will retry next run`,
      );
      return { status: "deferred", reason: "enrichment did not complete" };
    }
    if (error instanceof AIRateLimitError) {
      logger.warn(
        `AI rate limit hit — ${label} kept its existing content, will retry next run`,
      );
      deferredReason = "AI rate limit";
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
        {},
        claimBudget,
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

  return deferredReason
    ? { status: "deferred", reason: deferredReason }
    : { status: "written", id: rowId };
}

/**
 * Generate (or refresh) the cached dual-lens perspectives for a content item.
 * Skips generation when a row already exists for the current contentHash and
 * lens contract version, so unchanged, current content never re-pays for an LLM
 * call. AIRateLimitError propagates to the caller's rate-limit handler.
 */
export async function upsertContentLens(
  contentId: string,
  contentType: "bill" | "government_content" | "court_case",
  contentHash: string,
  title: string,
  fullText: string,
  articleType: string,
  aiGeneratedArticle?: string | null,
  claimBudget?: () => boolean,
): Promise<boolean> {
  const modelVersion = `${getTextModelVersion()}:concrete-examples-v2`;

  // Key the cache on what the lens actually reads, not on the bill's overall
  // contentHash. That hash also covers status, description and summary, so a
  // routine action update ("Referred to committee" -> "Received in the
  // Senate") invalidated it and paid for a fresh agentic research loop that
  // could only ever come back with the same argument — or a worse one. The
  // lens is nondeterministic and overwritten in place, so a needless
  // regeneration is a coin flip on losing a good result.
  const lensCacheKey = createContentHash(
    JSON.stringify({ title, fullText, articleType, modelVersion }),
  );

  const [existing] = await db
    .select({
      contentHash: ContentLens.contentHash,
      lensData: ContentLens.lensData,
      modelVersion: ContentLens.modelVersion,
    })
    .from(ContentLens)
    .where(
      and(
        eq(ContentLens.contentId, contentId),
        eq(ContentLens.contentType, contentType),
      ),
    )
    .limit(1);

  if (
    !forceAIRegeneration &&
    existing?.contentHash === lensCacheKey &&
    existing.modelVersion === modelVersion &&
    isUsableDualLens(existing.lensData)
  ) {
    logger.debug(`Dual-lens already cached for ${contentId}`);
    return true;
  }

  // Claimed after the cache check, never before: a cached lens costs nothing
  // and must not spend a slot. This loop is the single most expensive step in
  // the pipeline, so it is exactly what the budget exists to bound.
  if (claimBudget && !claimBudget()) {
    logger.info(
      `Run budget reached, deferring dual-lens for ${contentId} to a later run`,
    );
    return false;
  }

  const lens = await generateDualLens(
    title,
    buildDualLensGrounding(fullText, aiGeneratedArticle),
    articleType,
    framingForContentType(contentType),
  );
  if (!lens) {
    logger.warn(`Dual-lens generation returned null for ${contentId}`);
    return false;
  }

  await db
    .insert(ContentLens)
    .values({
      contentId,
      contentType,
      contentHash: lensCacheKey,
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
        contentHash: lensCacheKey,
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
  return true;
}

/**
 * Generate (or refresh) the cached structured brief for a bill. Skips the LLM
 * entirely when a usable row already exists for the current contentHash, so
 * unchanged bills never re-pay — same caching contract as `upsertContentLens`.
 * AIRateLimitError propagates to the caller's rate-limit handler.
 */
type AssembleResult =
  | { status: "ready"; id: string }
  | { status: "incomplete"; reason: string };

/**
 * What a brand-new bill must have before it is allowed into the database.
 *
 * Exported and pure so the rule is testable and hard to loosen by accident:
 * every condition here corresponds to something a reader would otherwise see
 * broken on the detail screen. Loosening one brings back the placeholder art
 * and raw-GPO-text state this path exists to prevent.
 *
 * The dual lens is deliberately absent. It is additive, its research loop can
 * legitimately return nothing, and the UI omits it cleanly — gating on it would
 * suppress good bills for a reason no reader would ever notice.
 */
export function newBillReadiness(candidate: {
  description?: string | null;
  fullText?: string | null;
  hasBrief: boolean;
  headerArt: { imageData: Buffer | null; thumbnailUrl: string | null } | null;
}): { ready: boolean; reason?: string } {
  if (!candidate.description?.trim()) {
    return { ready: false, reason: "no description could be produced" };
  }
  if (!isUsableSourceText(candidate.fullText)) {
    return { ready: false, reason: "no usable bill text yet" };
  }
  if (!candidate.hasBrief) {
    return { ready: false, reason: "brief generation failed" };
  }
  if (!candidate.headerArt) {
    return { ready: false, reason: "header art generation failed" };
  }
  // Generated art or a scraped thumbnail both render; neither means the reader
  // gets the grey placeholder.
  if (!candidate.headerArt.imageData && !candidate.headerArt.thumbnailUrl) {
    return { ready: false, reason: "no header art could be produced" };
  }
  return { ready: true };
}

/**
 * Build every required asset for a brand-new bill, then write the bill, its
 * header art and its brief in a single transaction.
 *
 * "Required" is deliberately narrow: a description, a structured brief, and
 * header art. Those are what the detail screen renders — without them a reader
 * gets a grey placeholder and a wall of raw GPO text, which is worse than the
 * bill simply not being there yet. The dual lens is *not* required: it runs an
 * agentic research loop that can legitimately come back empty, and the UI
 * degrades cleanly without it, so gating on it would suppress good bills for a
 * reason readers would never see.
 *
 * Nothing here writes until every required piece exists, so a failure at any
 * point leaves the database exactly as it was. There is no partial row to clean
 * up and no window in which a reader can see an unfinished bill.
 */
async function assembleNewBill(args: {
  data: BillData;
  contentHash: string;
  description?: string;
  label: string;
  claimBudget: () => boolean;
  billSourceVersions?: readonly BillSourceVersionInput[];
}): Promise<AssembleResult> {
  const { data, contentHash, label } = args;
  const description = args.description ?? data.description;

  // Cheap preconditions first, so a bill that can never be completed this run
  // does not spend budget or a generation call finding that out. The brief and
  // art are stubbed as present here because they have not been attempted yet —
  // the same rule runs again for real once they have.
  const precheck = newBillReadiness({
    description,
    fullText: data.fullText,
    hasBrief: true,
    headerArt: { imageData: null, thumbnailUrl: "pending" },
  });
  if (!precheck.ready) {
    return { status: "incomplete", reason: precheck.reason! };
  }
  // Narrowing for the compiler; `newBillReadiness` already rejected both.
  if (!description || !data.fullText) {
    return { status: "incomplete", reason: "missing description or text" };
  }
  if (!args.claimBudget()) {
    return { status: "incomplete", reason: "run budget reached" };
  }

  const billId = randomUUID();

  logger.start(`Assembling ${label} before storing it`);

  const brief = await buildBillBriefRecord({
    title: data.title,
    billNumber: data.billNumber,
    url: data.url,
    fullText: data.fullText,
    officialSummary: data.summary,
    status: data.status,
  });
  if (!brief) {
    return { status: "incomplete", reason: "brief generation failed" };
  }

  const video = await buildVideoRecord(
    "bill",
    data.title,
    data.fullText,
    contentHash,
    data.sourceWebsite,
  );

  const readiness = newBillReadiness({
    description,
    fullText: data.fullText,
    hasBrief: Boolean(brief),
    headerArt: video,
  });
  if (!readiness.ready || !video) {
    return {
      status: "incomplete",
      reason: readiness.reason ?? "header art generation failed",
    };
  }

  // Every required asset now exists in memory. The single transaction below is
  // the first and only write: either the bill, its art and its brief all become
  // visible together, or none of them ever existed.
  await db.transaction(async (tx) => {
    await tx.insert(Bill).values({
      ...data,
      id: billId,
      description: clampBillDescription(description),
      contentHash,
      versions: [],
    });
    await persistVideoRecord(tx, "bill", billId, video);
    await persistBillBrief(tx, billId, contentHash, brief);
  });

  if (args.billSourceVersions?.length) {
    await persistBillSourceVersions(billId, args.billSourceVersions);
  }

  incrementVideosGenerated();
  logger.success(`${label} stored complete (brief + header art)`);

  // The lens comes after the commit, on purpose. It is additive rather than
  // required, so it must not be able to hold back a bill that is otherwise
  // complete — and its research loop is far slower than everything above, so
  // running it inside the transaction would hold a connection open for minutes.
  // A failure here leaves a complete bill with no lens, which `retroactive-
  // lenses` fills in later.
  try {
    await upsertContentLens(
      billId,
      "bill",
      contentHash,
      data.title,
      data.fullText,
      "bill",
      null,
      args.claimBudget,
    );
  } catch (error) {
    logger.warn(
      `Dual lens failed for ${label} — the bill is stored and complete without it: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }

  return { status: "ready", id: billId };
}

/**
 * A structured brief, generated but not yet stored.
 *
 * Split out for the same reason as the video record: a bill's assets are all
 * produced before any row exists, so the bill can be written complete in one
 * transaction rather than appearing and then filling in.
 */
export interface BuiltBillBrief {
  brief: NonNullable<Awaited<ReturnType<typeof generateBillBrief>>> & {
    generatedAt: string;
    modelVersion: string;
  };
  modelVersion: string;
}

/** Generate a brief in memory. Returns null when generation fails. */
export async function buildBillBriefRecord(args: {
  title: string;
  billNumber: string;
  url: string;
  fullText: string;
  officialSummary?: string | null;
  status?: string | null;
  priorArticle?: string | null;
}): Promise<BuiltBillBrief | null> {
  const generated = await generateBillBrief({
    title: args.title,
    billNumber: args.billNumber,
    url: args.url,
    fullText: args.fullText,
    officialSummary: args.officialSummary,
    status: args.status,
    priorArticle: args.priorArticle,
  });
  if (!generated) {
    logger.warn(`Brief generation returned null for ${args.billNumber}`);
    return null;
  }

  const modelVersion = getTextModelVersion();
  return {
    brief: { ...generated, generatedAt: new Date().toISOString(), modelVersion },
    modelVersion,
  };
}

/**
 * Write a previously built brief. Takes an executor so it can run inside the
 * same transaction as the bill row it describes.
 */
export async function persistBillBrief(
  executor: DbExecutor,
  contentId: string,
  contentHash: string,
  record: BuiltBillBrief,
): Promise<void> {
  await executor
    .insert(ContentBrief)
    .values({
      contentId,
      contentType: "bill",
      contentHash,
      brief: record.brief,
      modelVersion: record.modelVersion,
    })
    .onConflictDoUpdate({
      target: [ContentBrief.contentType, ContentBrief.contentId],
      set: {
        contentHash,
        brief: record.brief,
        modelVersion: record.modelVersion,
        updatedAt: new Date(),
      },
    });
}

export async function upsertBillBrief(args: {
  contentId: string;
  contentHash: string;
  title: string;
  billNumber: string;
  url: string;
  fullText: string;
  officialSummary?: string | null;
  status?: string | null;
  priorArticle?: string | null;
  claimBudget?: () => boolean;
}): Promise<boolean> {
  const [existing] = await db
    .select({
      contentHash: ContentBrief.contentHash,
      brief: ContentBrief.brief,
    })
    .from(ContentBrief)
    .where(
      and(
        eq(ContentBrief.contentId, args.contentId),
        eq(ContentBrief.contentType, "bill"),
      ),
    )
    .limit(1);

  if (
    !forceAIRegeneration &&
    existing?.contentHash === args.contentHash &&
    isCurrentBillBrief(existing.brief)
  ) {
    logger.debug(`Brief already cached for ${args.billNumber}`);
    return true;
  }

  // Same contract as the lens: only a real generation draws on the budget.
  if (args.claimBudget && !args.claimBudget()) {
    logger.info(
      `Run budget reached, deferring brief for ${args.billNumber} to a later run`,
    );
    return false;
  }

  const record = await buildBillBriefRecord(args);
  if (!record) return false;

  await persistBillBrief(db, args.contentId, args.contentHash, record);

  logger.success(`Cached brief for ${args.billNumber}`);
  return true;
}
