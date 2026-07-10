import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, asc, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CourtCase, GovernmentContent, Video } from "@acme/db/schema";

import type { ReprocessMode } from "./utils/reprocessing-policy.js";
import { databaseTarget, databaseTargetMessage } from "./env.js";
import { generateImageSearchKeywords } from "./utils/ai/image-keywords.js";
import {
  AIRateLimitError,
  generateAIArticle,
} from "./utils/ai/text-generation.js";
import { getThumbnailImage } from "./utils/api/google-images.js";
import { getCostSummary, resetCosts } from "./utils/costs.js";
import { generateVideoForContent } from "./utils/db/video-operations.js";
import { createContentHash } from "./utils/hash.js";
import {
  createLogger,
  printFooter,
  printHeader,
  printKeyValue,
} from "./utils/log.js";
import {
  hasVideoImage,
  isUsableAIArticle,
  isUsableSourceText,
  needsReprocessing,
} from "./utils/reprocessing-policy.js";
import { refreshSourceText } from "./utils/source-refresh.js";

const logger = createLogger("reprocess");

const CONTENT_TYPES = ["bill", "government_content", "court_case"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  fullText: string | null;
  aiGeneratedArticle: string | null;
  thumbnailUrl: string | null;
  url: string;
  contentHash: string;
  author: string;
  articleType: string;
  videoId: string | null;
  videoImageData: Buffer | null;
  videoThumbnailUrl: string | null;
}

interface ProcessResult {
  id: string;
  type: ContentType;
  status: "updated" | "partial" | "skipped" | "failed";
  errors: string[];
}

function rowState(item: ContentItem) {
  return {
    fullText: item.fullText,
    aiGeneratedArticle: item.aiGeneratedArticle,
    videoId: item.videoId,
    videoImageData: item.videoImageData,
    videoThumbnailUrl: item.videoThumbnailUrl,
  };
}

async function loadContentItems(
  type: ContentType,
  afterId?: string,
): Promise<ContentItem[]> {
  if (type === "bill") {
    const query = db
      .select({
        id: Bill.id,
        title: Bill.title,
        fullText: Bill.fullText,
        aiGeneratedArticle: Bill.aiGeneratedArticle,
        thumbnailUrl: Bill.thumbnailUrl,
        url: Bill.url,
        contentHash: Bill.contentHash,
        author: Bill.sourceWebsite,
        videoId: Video.id,
        videoImageData: Video.imageData,
        videoThumbnailUrl: Video.thumbnailUrl,
      })
      .from(Bill)
      .leftJoin(
        Video,
        and(eq(Video.contentType, "bill"), eq(Video.contentId, Bill.id)),
      )
      .orderBy(asc(Bill.id));
    const rows = afterId
      ? await query.where(gt(Bill.id, afterId))
      : await query;
    return rows.map((row) => ({
      ...row,
      type,
      articleType: "bill",
    }));
  }

  if (type === "government_content") {
    const query = db
      .select({
        id: GovernmentContent.id,
        title: GovernmentContent.title,
        fullText: GovernmentContent.fullText,
        aiGeneratedArticle: GovernmentContent.aiGeneratedArticle,
        thumbnailUrl: GovernmentContent.thumbnailUrl,
        url: GovernmentContent.url,
        contentHash: GovernmentContent.contentHash,
        author: GovernmentContent.source,
        articleType: GovernmentContent.type,
        videoId: Video.id,
        videoImageData: Video.imageData,
        videoThumbnailUrl: Video.thumbnailUrl,
      })
      .from(GovernmentContent)
      .leftJoin(
        Video,
        and(
          eq(Video.contentType, "government_content"),
          eq(Video.contentId, GovernmentContent.id),
        ),
      )
      .orderBy(asc(GovernmentContent.id));
    const rows = afterId
      ? await query.where(gt(GovernmentContent.id, afterId))
      : await query;
    return rows.map((row) => ({ ...row, type }));
  }

  const query = db
    .select({
      id: CourtCase.id,
      title: CourtCase.title,
      fullText: CourtCase.fullText,
      aiGeneratedArticle: CourtCase.aiGeneratedArticle,
      thumbnailUrl: CourtCase.thumbnailUrl,
      url: CourtCase.url,
      contentHash: CourtCase.contentHash,
      author: CourtCase.court,
      videoId: Video.id,
      videoImageData: Video.imageData,
      videoThumbnailUrl: Video.thumbnailUrl,
    })
    .from(CourtCase)
    .leftJoin(
      Video,
      and(
        eq(Video.contentType, "court_case"),
        eq(Video.contentId, CourtCase.id),
      ),
    )
    .orderBy(asc(CourtCase.id));
  const rows = afterId
    ? await query.where(gt(CourtCase.id, afterId))
    : await query;
  return rows.map((row) => ({
    ...row,
    type,
    articleType: "court case",
  }));
}

async function updateContentAssets(
  item: ContentItem,
  values: { aiGeneratedArticle?: string; thumbnailUrl?: string },
): Promise<void> {
  if (Object.keys(values).length === 0) return;

  const update = { ...values, updatedAt: new Date() };
  if (item.type === "bill") {
    await db.update(Bill).set(update).where(eq(Bill.id, item.id));
  } else if (item.type === "government_content") {
    await db
      .update(GovernmentContent)
      .set(update)
      .where(eq(GovernmentContent.id, item.id));
  } else {
    await db.update(CourtCase).set(update).where(eq(CourtCase.id, item.id));
  }
}

async function updateSourceText(
  item: ContentItem,
  fullText: string,
  contentHash: string,
): Promise<void> {
  const update = { fullText, contentHash, updatedAt: new Date() };
  if (item.type === "bill") {
    await db.update(Bill).set(update).where(eq(Bill.id, item.id));
  } else if (item.type === "government_content") {
    await db
      .update(GovernmentContent)
      .set(update)
      .where(eq(GovernmentContent.id, item.id));
  } else {
    await db.update(CourtCase).set(update).where(eq(CourtCase.id, item.id));
  }
}

async function processItem(
  item: ContentItem,
  mode: ReprocessMode,
  assets: "all" | "images",
): Promise<ProcessResult> {
  let fullText = item.fullText;
  let contentHash = item.contentHash;
  if (!isUsableSourceText(fullText)) {
    logger.start(`${item.type}:${item.id} re-fetching missing source text`);
    const refreshed = await refreshSourceText(item);
    if (!isUsableSourceText(refreshed)) {
      return {
        id: item.id,
        type: item.type,
        status: "partial",
        errors: ["source text is empty and re-fetch did not recover it"],
      };
    }
    fullText = refreshed;
    contentHash = createContentHash(
      JSON.stringify({ previous: item.contentHash, fullText }),
    );
    await updateSourceText(item, fullText, contentHash);
    logger.success(`${item.type}:${item.id} recovered source text`);
  }

  const errors: string[] = [];
  let replacementArticle: string | undefined;
  let replacementThumbnail: string | undefined;
  const shouldGenerateArticle =
    assets === "all" &&
    (mode === "replace" || !isUsableAIArticle(item.aiGeneratedArticle));
  const imageSearchReady = Boolean(
    process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID,
  );
  const shouldSearchThumbnail =
    imageSearchReady && (mode === "replace" || !item.thumbnailUrl);

  const [articleResult, thumbnailResult] = await Promise.allSettled([
    shouldGenerateArticle
      ? (async () => {
          for (let attempt = 1; attempt <= 2; attempt++) {
            const article = await generateAIArticle(
              item.title,
              fullText,
              item.articleType,
              item.url,
            );
            if (isUsableAIArticle(article)) return article;
            logger.warn(
              `${item.type}:${item.id} article failed quality validation (attempt ${attempt}/2)`,
            );
          }
          return undefined;
        })()
      : Promise.resolve(undefined),
    shouldSearchThumbnail
      ? generateImageSearchKeywords(
          item.title,
          fullText,
          item.articleType,
        ).then((keywords) => getThumbnailImage(keywords))
      : Promise.resolve(undefined),
  ]);

  if (articleResult.status === "fulfilled") {
    if (articleResult.value && isUsableAIArticle(articleResult.value)) {
      replacementArticle = articleResult.value;
    } else if (shouldGenerateArticle) {
      errors.push("AI article failed structural quality validation");
    }
  } else {
    errors.push(
      articleResult.reason instanceof Error
        ? articleResult.reason.message
        : String(articleResult.reason),
    );
  }

  if (thumbnailResult.status === "fulfilled") {
    replacementThumbnail = thumbnailResult.value ?? undefined;
  } else {
    errors.push(
      thumbnailResult.reason instanceof Error
        ? thumbnailResult.reason.message
        : String(thumbnailResult.reason),
    );
  }

  await updateContentAssets(item, {
    ...(replacementArticle && { aiGeneratedArticle: replacementArticle }),
    ...(replacementThumbnail && { thumbnailUrl: replacementThumbnail }),
  });

  const effectiveThumbnail = replacementThumbnail ?? item.thumbnailUrl;
  let videoHasImage = hasVideoImage(rowState(item));
  try {
    const video = await generateVideoForContent(
      item.type,
      item.id,
      item.title,
      fullText,
      contentHash,
      item.author,
      effectiveThumbnail,
      { force: mode === "replace", preserveCopy: assets === "images" },
    );
    videoHasImage = video.hasImage;
    if (!videoHasImage) errors.push("video has no generated or fallback image");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const articleIsUsable = isUsableAIArticle(
    replacementArticle ?? item.aiGeneratedArticle,
  );
  return {
    id: item.id,
    type: item.type,
    status:
      articleIsUsable && videoHasImage
        ? errors.length === 0
          ? "updated"
          : "partial"
        : "partial",
    errors,
  };
}

function printInventory(
  type: ContentType,
  items: ContentItem[],
  mode: ReprocessMode,
) {
  const usable = items.filter((item) => isUsableSourceText(item.fullText));
  const selected = usable.filter((item) =>
    needsReprocessing(rowState(item), mode),
  );
  printHeader(type);
  printKeyValue("Rows", items.length);
  printKeyValue("Usable source text", usable.length);
  printKeyValue("Missing/invalid source text", items.length - usable.length);
  printKeyValue(
    "Invalid/missing article",
    items.filter((item) => !isUsableAIArticle(item.aiGeneratedArticle)).length,
  );
  printKeyValue(
    "Missing feed image",
    items.filter((item) => !hasVideoImage(rowState(item))).length,
  );
  printKeyValue(`Selected (${mode})`, selected.length);
  printFooter();
}

const argv = await yargs(hideBin(process.argv))
  .option("type", {
    alias: "t",
    choices: [...CONTENT_TYPES, "all"] as const,
    default: "all" as const,
    description: "Content table to process",
  })
  .option("mode", {
    choices: ["missing", "replace"] as const,
    default: "replace" as const,
    description: "Backfill incomplete rows or replace all derived AI assets",
  })
  .option("limit", {
    alias: "l",
    type: "number",
    description: "Maximum selected rows per content type",
  })
  .option("after-id", {
    type: "string",
    description: "Resume after this UUID (only valid with one content type)",
  })
  .option("id", {
    type: "array",
    string: true,
    description: "Process only these content UUIDs (repeatable)",
  })
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 1,
    description: "Concurrent AI jobs (1-5)",
  })
  .option("assets", {
    choices: ["all", "images"] as const,
    default: "all" as const,
    description: "Regenerate every derived asset or feed imagery only",
  })
  .option("apply", {
    type: "boolean",
    default: false,
    description:
      "Write replacements; without this flag the command is read-only",
  })
  .option("yes", {
    type: "boolean",
    default: false,
    description: "Acknowledge production writes",
  })
  .check((args) => {
    if (
      args.limit !== undefined &&
      (!Number.isInteger(args.limit) || args.limit <= 0)
    ) {
      throw new Error("--limit must be a positive integer");
    }
    if (
      !Number.isInteger(args.concurrency) ||
      args.concurrency < 1 ||
      args.concurrency > 5
    ) {
      throw new Error("--concurrency must be an integer from 1 to 5");
    }
    if (args.afterId && args.type === "all") {
      throw new Error("--after-id requires a specific --type");
    }
    if (args.afterId && args.id?.length) {
      throw new Error("--after-id and --id cannot be combined");
    }
    return true;
  })
  .strict()
  .help()
  .parse();

async function main(): Promise<void> {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("POSTGRES_URL is required");

  const target = databaseTarget(databaseUrl);
  if (argv.apply && target.target === "production" && !argv.yes) {
    throw new Error("Production writes require both --apply and --yes");
  }
  if (argv.apply && !process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is required when --apply is set");
  }
  if (argv.apply && !process.env.BFL_API_KEY) {
    throw new Error(
      "BFL_API_KEY is required to guarantee generated feed images",
    );
  }

  logger[target.target === "production" ? "warn" : "info"](
    databaseTargetMessage(databaseUrl),
  );
  if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
    logger.info(
      "Google image search is not configured; content thumbnails will be preserved and feed images will use FLUX",
    );
  }

  const types = argv.type === "all" ? CONTENT_TYPES : [argv.type];
  const inventory = new Map<ContentType, ContentItem[]>();
  for (const type of types) {
    const items = await loadContentItems(type, argv.afterId);
    inventory.set(type, items);
    printInventory(type, items, argv.mode);
  }

  const selected = [...inventory.values()].flatMap((items) =>
    items
      .filter((item) => !argv.id?.length || argv.id.includes(item.id))
      .filter((item) => needsReprocessing(rowState(item), argv.mode))
      .slice(0, argv.limit),
  );

  printHeader("Run");
  printKeyValue("Mode", argv.mode);
  printKeyValue("Selected rows", selected.length);
  printKeyValue("Concurrency", argv.concurrency);
  printKeyValue("Assets", argv.assets);
  printKeyValue("Writes", argv.apply ? "enabled" : "disabled (inventory only)");
  printFooter();

  if (!argv.apply || selected.length === 0) return;

  resetCosts();
  const limit = pLimit(argv.concurrency);
  const results = await Promise.all(
    selected.map((item) =>
      limit(async () => {
        logger.start(`${item.type}:${item.id} ${item.title.substring(0, 80)}`);
        try {
          const result = await processItem(item, argv.mode, argv.assets);
          if (result.status === "updated") {
            logger.success(
              `${item.type}:${item.id} replaced and verified in-process`,
            );
          } else {
            logger.warn(
              `${item.type}:${item.id} ${result.status}: ${result.errors.join("; ")}`,
            );
          }
          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(`${item.type}:${item.id} failed: ${message}`);
          return {
            id: item.id,
            type: item.type,
            status: "failed",
            errors: [message],
          } satisfies ProcessResult;
        }
      }),
    ),
  );

  // Re-query the database so success is based on persisted state, not only
  // provider responses or successful UPDATE calls.
  let verified = 0;
  for (const type of types) {
    const processedIds = new Set(
      results
        .filter((result) => result.type === type)
        .map((result) => result.id),
    );
    if (processedIds.size === 0) continue;
    const persisted = await loadContentItems(type);
    verified += persisted.filter(
      (item) =>
        processedIds.has(item.id) &&
        isUsableAIArticle(item.aiGeneratedArticle) &&
        hasVideoImage(rowState(item)),
    ).length;
  }

  const costs = getCostSummary();
  printHeader("Result");
  printKeyValue(
    "Updated",
    results.filter((r) => r.status === "updated").length,
  );
  printKeyValue(
    "Partial",
    results.filter((r) => r.status === "partial").length,
  );
  printKeyValue("Failed", results.filter((r) => r.status === "failed").length);
  printKeyValue("Persisted + verified", `${verified}/${results.length}`);
  printKeyValue("Estimated API cost", `$${costs.totalCost.toFixed(4)}`);
  printFooter();

  const failures = results.filter(
    (result) => result.status === "partial" || result.status === "failed",
  );
  if (failures.length > 0) {
    logger.warn(
      `Retry these IDs: ${failures.map((failure) => failure.id).join(",")}`,
    );
    if (
      failures.some((failure) =>
        failure.errors.some((error) => error.includes("rate limit")),
      )
    ) {
      throw new AIRateLimitError();
    }
    process.exitCode = 1;
  }
}

await main();
