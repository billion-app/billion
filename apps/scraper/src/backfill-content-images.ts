import { parseArgs } from "node:util";

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from "@acme/db";
import { db } from "@acme/db/client";
import { Video } from "@acme/db/schema";

import { databaseTargetMessage } from "./env.js";
import { createLogger } from "./utils/log.js";
import { uploadGeneratedContentImage } from "./utils/storage/content-images.js";

const logger = createLogger("content-image-backfill");

type ContentType = "bill" | "government_content" | "court_case";

function isContentType(value: string): value is ContentType {
  return (
    value === "bill" || value === "government_content" || value === "court_case"
  );
}

async function logMetrics(label: string): Promise<void> {
  const [metrics] = await db
    .select({
      legacyRows: sql<number>`count(*) filter (where ${Video.imageData} is not null)::int`,
      legacyBytes: sql<number>`coalesce(sum(octet_length(${Video.imageData})) filter (where ${Video.imageData} is not null), 0)::bigint`,
      storageRows: sql<number>`count(*) filter (where ${Video.generatedImagePath} is not null)::int`,
      failedRows: sql<number>`count(*) filter (where ${Video.imageStorageError} is not null)::int`,
    })
    .from(Video);
  logger.info(
    `${label}: legacy_rows=${metrics?.legacyRows ?? 0} legacy_bytes=${metrics?.legacyBytes ?? 0} storage_rows=${metrics?.storageRows ?? 0} failed_rows=${metrics?.failedRows ?? 0}`,
  );
}

async function backfill(batchSize: number, apply: boolean): Promise<void> {
  let cursor = "";
  let migrated = 0;
  let failed = 0;

  for (;;) {
    const rows = await db
      .select({
        id: Video.id,
        contentType: Video.contentType,
        contentId: Video.contentId,
        imageData: Video.imageData,
        imageMimeType: Video.imageMimeType,
      })
      .from(Video)
      .where(
        and(
          isNotNull(Video.imageData),
          isNull(Video.generatedImagePath),
          cursor ? gt(Video.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(Video.id))
      .limit(batchSize);

    if (rows.length === 0) break;
    cursor = rows.at(-1)!.id;

    for (const row of rows) {
      if (!apply) {
        logger.info(
          `Would backfill ${row.contentType}:${row.contentId} (${row.imageData?.byteLength ?? 0} bytes)`,
        );
        continue;
      }

      try {
        if (!row.imageData || row.imageMimeType !== "image/jpeg") {
          throw new Error(
            `Unsupported legacy image MIME type: ${row.imageMimeType ?? "missing"}`,
          );
        }
        if (!isContentType(row.contentType)) {
          throw new Error(`Unsupported content type: ${row.contentType}`);
        }

        const stored = await uploadGeneratedContentImage({
          contentType: row.contentType,
          contentId: row.contentId,
          imageData: row.imageData,
        });
        await db
          .update(Video)
          .set({
            generatedImagePath: stored.path,
            generatedImageHash: stored.hash,
            imageStorageVerifiedAt: stored.verifiedAt,
            imageStorageError: null,
            imageStorageAttempts: sql`coalesce(${Video.imageStorageAttempts}, 0) + 1`,
          })
          .where(eq(Video.id, row.id));
        migrated += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(Video)
          .set({
            imageStorageError: message.slice(0, 2_000),
            imageStorageAttempts: sql`coalesce(${Video.imageStorageAttempts}, 0) + 1`,
          })
          .where(eq(Video.id, row.id));
        logger.warn(`Failed ${row.id}: ${message}`);
      }
    }
  }

  logger.info(
    apply
      ? `Backfill complete: migrated=${migrated} failed=${failed}`
      : "Dry run complete; pass --apply to upload and update rows.",
  );
}

async function cleanup(
  batchSize: number,
  rollbackDays: number,
  apply: boolean,
): Promise<void> {
  const cutoff = new Date(Date.now() - rollbackDays * 86_400_000);
  const rows = await db
    .select({ id: Video.id })
    .from(Video)
    .where(
      and(
        isNotNull(Video.imageData),
        isNotNull(Video.generatedImagePath),
        isNotNull(Video.imageStorageVerifiedAt),
        lt(Video.imageStorageVerifiedAt, cutoff),
        isNull(Video.imageStorageError),
      ),
    )
    .orderBy(asc(Video.id))
    .limit(batchSize);

  if (!apply) {
    logger.info(
      `Would clear ${rows.length} verified blobs older than ${rollbackDays} days; pass --apply to proceed.`,
    );
    return;
  }
  if (rows.length === 0) {
    logger.info("No verified legacy blobs are eligible for cleanup.");
    return;
  }

  const ids = rows.map((row) => row.id);
  await db.update(Video).set({ imageData: null }).where(inArray(Video.id, ids));
  logger.info(`Cleared ${ids.length} verified legacy blobs.`);
}

export async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      cleanup: { type: "boolean", default: false },
      "batch-size": { type: "string", default: "50" },
      "rollback-days": { type: "string", default: "14" },
    },
  });
  const batchSize = Number(values["batch-size"]);
  const rollbackDays = Number(values["rollback-days"]);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("--batch-size must be an integer from 1 to 500");
  }
  if (!Number.isInteger(rollbackDays) || rollbackDays < 1) {
    throw new Error("--rollback-days must be a positive integer");
  }

  logger.info(databaseTargetMessage(process.env.POSTGRES_URL!));
  await logMetrics("before");
  if (values.cleanup) {
    await cleanup(batchSize, rollbackDays, values.apply);
  } else {
    await backfill(batchSize, values.apply);
  }
  await logMetrics("after");
}
