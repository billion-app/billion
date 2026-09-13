import pLimit from "p-limit";
import sharp from "sharp";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNull, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentImage,
  ContentImageReview as ContentImageReviewRow,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import type { ContentImageReview } from "./utils/ai/content-image-review.js";
import {
  CONTENT_IMAGE_REVIEW_VERSION,
  generateContentImage,
  missingSourceDescriptionReview,
  reviewContentImage,
} from "./utils/ai/content-image-review.js";
import {
  CONTENT_IMAGE_STYLE_VERSION,
  planRenderedContentImagePrompt,
  versionContentImageHash,
} from "./utils/ai/content-image-visual.js";
import { generateLocalPhoto } from "./utils/ai/image-generation.js";
import {
  getDeepSeekVisionApiKey,
  getLocalLlmConfig,
} from "./utils/ai/provider.js";
import { runImageBatches } from "./utils/image-batches.js";
import { createLogger } from "./utils/log.js";
import { uploadContentImage } from "./utils/storage/content-images.js";

const logger = createLogger("content-images");
type ContentType = "bill" | "government_content" | "court_case";

interface Candidate {
  id: string;
  type: ContentType;
  title: string;
  description: string;
  contentHash: string;
}

async function billCandidates(limit: number): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: Bill.id,
      title: Bill.title,
      description: sql<string>`coalesce(${Bill.description}, ${Bill.summary}, '')`,
      contentHash: Bill.contentHash,
    })
    .from(Bill)
    .leftJoin(
      ContentImage,
      and(
        eq(ContentImage.contentType, "bill"),
        eq(ContentImage.contentId, Bill.id),
      ),
    )
    .leftJoin(
      ContentImageReviewRow,
      and(
        eq(ContentImageReviewRow.contentType, "bill"),
        eq(ContentImageReviewRow.contentId, Bill.id),
      ),
    )
    .where(
      and(
        or(
          isNull(ContentImage.id),
          sql`${ContentImage.contentHash} <> md5(${`${CONTENT_IMAGE_STYLE_VERSION}:`} || ${Bill.contentHash})`,
        ),
        sql`(
          ${ContentImageReviewRow.id} is null
          or ${ContentImageReviewRow.status} <> 'rejected'
          or ${ContentImageReviewRow.contentHash} <> ${Bill.contentHash}
          or ${ContentImageReviewRow.styleVersion} <> ${CONTENT_IMAGE_STYLE_VERSION}
          or (
            ${ContentImageReviewRow.attempts} = 0
            and
            ${ContentImageReviewRow.rejectionReasons} @> '["insufficient-source-description"]'::jsonb
            and btrim(coalesce(${Bill.description}, ${Bill.summary}, '')) <> ''
          )
        )`,
      ),
    )
    .orderBy(
      sql`case when replace(lower(${Bill.billNumber}), '.', '') = 'hr 3633' then 0 else 1 end`,
      desc(
        sql`coalesce(${Bill.lastActionAt}, ${Bill.introducedDate}, ${Bill.createdAt})`,
      ),
    )
    .limit(limit);
  return rows.map((row) => ({ ...row, type: "bill" }));
}

async function governmentCandidates(limit: number): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: GovernmentContent.id,
      title: GovernmentContent.title,
      description: sql<string>`coalesce(${GovernmentContent.description}, '')`,
      contentHash: GovernmentContent.contentHash,
    })
    .from(GovernmentContent)
    .leftJoin(
      ContentImage,
      and(
        eq(ContentImage.contentType, "government_content"),
        eq(ContentImage.contentId, GovernmentContent.id),
      ),
    )
    .leftJoin(
      ContentImageReviewRow,
      and(
        eq(ContentImageReviewRow.contentType, "government_content"),
        eq(ContentImageReviewRow.contentId, GovernmentContent.id),
      ),
    )
    .where(
      and(
        or(
          isNull(ContentImage.id),
          sql`${ContentImage.contentHash} <> md5(${`${CONTENT_IMAGE_STYLE_VERSION}:`} || ${GovernmentContent.contentHash})`,
        ),
        sql`(
          ${ContentImageReviewRow.id} is null
          or ${ContentImageReviewRow.status} <> 'rejected'
          or ${ContentImageReviewRow.contentHash} <> ${GovernmentContent.contentHash}
          or ${ContentImageReviewRow.styleVersion} <> ${CONTENT_IMAGE_STYLE_VERSION}
          or (
            ${ContentImageReviewRow.attempts} = 0
            and
            ${ContentImageReviewRow.rejectionReasons} @> '["insufficient-source-description"]'::jsonb
            and btrim(coalesce(${GovernmentContent.description}, '')) <> ''
          )
        )`,
      ),
    )
    .orderBy(desc(GovernmentContent.publishedDate))
    .limit(limit);
  return rows.map((row) => ({ ...row, type: "government_content" }));
}

async function courtCandidates(limit: number): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: CourtCase.id,
      title: CourtCase.title,
      description: sql<string>`coalesce(${CourtCase.description}, '')`,
      contentHash: CourtCase.contentHash,
    })
    .from(CourtCase)
    .leftJoin(
      ContentImage,
      and(
        eq(ContentImage.contentType, "court_case"),
        eq(ContentImage.contentId, CourtCase.id),
      ),
    )
    .leftJoin(
      ContentImageReviewRow,
      and(
        eq(ContentImageReviewRow.contentType, "court_case"),
        eq(ContentImageReviewRow.contentId, CourtCase.id),
      ),
    )
    .where(
      and(
        or(
          isNull(ContentImage.id),
          sql`${ContentImage.contentHash} <> md5(${`${CONTENT_IMAGE_STYLE_VERSION}:`} || ${CourtCase.contentHash})`,
        ),
        sql`(
          ${ContentImageReviewRow.id} is null
          or ${ContentImageReviewRow.status} <> 'rejected'
          or ${ContentImageReviewRow.contentHash} <> ${CourtCase.contentHash}
          or ${ContentImageReviewRow.styleVersion} <> ${CONTENT_IMAGE_STYLE_VERSION}
          or (
            ${ContentImageReviewRow.attempts} = 0
            and
            ${ContentImageReviewRow.rejectionReasons} @> '["insufficient-source-description"]'::jsonb
            and btrim(coalesce(${CourtCase.description}, '')) <> ''
          )
        )`,
      ),
    )
    .orderBy(desc(CourtCase.filedDate), desc(CourtCase.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, type: "court_case" }));
}

function reviewValues(
  item: Candidate,
  review: ContentImageReview,
  status: "accepted" | "rejected",
  attempts: number,
  now = new Date(),
) {
  return {
    contentType: item.type,
    contentId: item.id,
    contentHash: item.contentHash,
    styleVersion: CONTENT_IMAGE_STYLE_VERSION,
    status,
    description: review.description,
    rejectionReasons: review.rejectionReasons,
    feedback: review.feedback ?? null,
    modelVersion: review.reviewModelVersion ?? CONTENT_IMAGE_REVIEW_VERSION,
    attempts,
    updatedAt: now,
  };
}

async function persistRejectedReview(
  item: Candidate,
  review: ContentImageReview,
  attempts: number,
): Promise<void> {
  const values = reviewValues(item, review, "rejected", attempts);
  await db
    .insert(ContentImageReviewRow)
    .values(values)
    .onConflictDoUpdate({
      target: [
        ContentImageReviewRow.contentType,
        ContentImageReviewRow.contentId,
      ],
      set: values,
    });
}

async function generate(
  item: Candidate,
  skipReview: boolean,
): Promise<"accepted" | "rejected"> {
  const description = item.description.trim();
  const missingDescriptionReview = missingSourceDescriptionReview(item);
  if (missingDescriptionReview) {
    await persistRejectedReview(item, missingDescriptionReview, 0);
    return "rejected";
  }

  const result = await generateContentImage({
    source: { title: item.title, description },
    skipReview,
    generate: async (feedback) => {
      const prompt = await planRenderedContentImagePrompt(
        item,
        undefined,
        3,
        feedback,
      );
      const image = await generateLocalPhoto(prompt, 1024, 768);
      return image ? { image, prompt } : null;
    },
    review: reviewContentImage,
  });

  if (result.status === "error") {
    throw result.error;
  }
  if (result.status === "rejected") {
    await persistRejectedReview(item, result.review, result.reviewAttempts);
    return "rejected";
  }

  const data = await sharp(result.generated.image.data)
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  const stored = await uploadContentImage({
    contentType: item.type,
    contentId: item.id,
    data,
  });
  const imageValues = {
    contentType: item.type,
    contentId: item.id,
    contentHash: versionContentImageHash(item.contentHash),
    storagePath: stored.path,
    imageHash: stored.hash,
    prompt: result.generated.prompt,
    width: 1024,
    height: 768,
    updatedAt: new Date(),
  };
  const reviewValuesToWrite =
    result.status === "accepted"
      ? reviewValues(item, result.review, "accepted", result.reviewAttempts)
      : null;
  await db.transaction(async (tx) => {
    await tx
      .insert(ContentImage)
      .values(imageValues)
      .onConflictDoUpdate({
        target: [ContentImage.contentType, ContentImage.contentId],
        set: imageValues,
      });
    if (reviewValuesToWrite) {
      await tx
        .insert(ContentImageReviewRow)
        .values(reviewValuesToWrite)
        .onConflictDoUpdate({
          target: [
            ContentImageReviewRow.contentType,
            ContentImageReviewRow.contentId,
          ],
          set: reviewValuesToWrite,
        });
    } else {
      // A prior review belongs to a prior image. Remove it rather than making
      // the newly published bypass image look reviewed.
      await tx
        .delete(ContentImageReviewRow)
        .where(
          and(
            eq(ContentImageReviewRow.contentType, item.type),
            eq(ContentImageReviewRow.contentId, item.id),
          ),
        );
    }
  });
  return "accepted";
}

const argv = await yargs(hideBin(process.argv))
  .option("bill-limit", {
    type: "number",
    default: 80,
    describe: "Maximum retained bills to generate",
  })
  .option("other-limit", {
    type: "number",
    default: 20,
    describe: "Maximum government and court items per type",
  })
  .option("concurrency", { type: "number", default: 1 })
  .option("dry-run", { type: "boolean", default: false })
  .option("skip-review", {
    type: "boolean",
    default: false,
    describe:
      "Publish generated images without the DeepSeek suitability review",
  })
  .option("drain", {
    type: "boolean",
    default: false,
    describe:
      "Repeat batches until no missing or stale images remain; stop on failure",
  })
  .strict()
  .parseAsync();

if (argv.billLimit < 0 || argv.billLimit > 1000) {
  throw new Error("--bill-limit must be between 0 and 1000");
}
if (argv.otherLimit < 0 || argv.otherLimit > 1000) {
  throw new Error("--other-limit must be between 0 and 1000");
}
if (argv.concurrency < 1 || argv.concurrency > 2) {
  throw new Error("--concurrency must be 1 or 2");
}

await runImageBatches(async () => {
  const candidates = [
    ...(await billCandidates(argv.billLimit)),
    ...(await governmentCandidates(argv.otherLimit)),
    ...(await courtCandidates(argv.otherLimit)),
  ];
  logger.info(
    `Found ${candidates.length} missing or stale header image(s), capped at ${argv.billLimit} bills and ${argv.otherLimit} per other type`,
  );
  if (argv.dryRun) {
    for (const item of candidates)
      logger.info(`Would generate ${item.type}:${item.id} ${item.title}`);
    process.exit(0);
  }

  if (argv.skipReview) {
    logger.warn(
      "Image review is disabled; generated images will be published without a suitability check",
    );
  } else {
    // Validate that either the preferred local model or the hosted fallback is
    // configured before FLUX spends time generating an image.
    if (!getLocalLlmConfig()) getDeepSeekVisionApiKey();
  }

  let completed = 0;
  let accepted = 0;
  let rejected = 0;
  let failed = 0;
  const limit = pLimit(argv.concurrency);
  await Promise.all(
    candidates.map((item) =>
      limit(async () => {
        try {
          const outcome = await generate(item, argv.skipReview);
          completed += 1;
          if (outcome === "rejected") {
            rejected += 1;
            logger.warn(
              `${completed}/${candidates.length} ${item.type}:${item.id} rejected by image review`,
            );
          } else {
            accepted += 1;
            logger.success(
              `${completed}/${candidates.length} ${item.type}:${item.id}`,
            );
          }
        } catch (error) {
          failed += 1;
          logger.warn(`Failed ${item.type}:${item.id}`, error);
        }
      }),
    ),
  );
  logger.info(
    `Done: accepted=${accepted} rejected=${rejected} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
  return { completed, failed };
}, argv.drain);
