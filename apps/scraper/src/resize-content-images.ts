import { createHash } from "node:crypto";

import { and, asc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  contentImagePublicUrl,
  supabaseStorageOrigin,
} from "@acme/db/content-images";
import { ContentImage } from "@acme/db/schema";

import { databaseTarget } from "./env.js";
import { createLogger } from "./utils/log.js";
import { uploadContentImage } from "./utils/storage/content-images.js";

const logger = createLogger("resize-content-images");

export async function resizeContentImages(
  options: {
    limit: number;
    apply: boolean;
    target: "local" | "production";
  },
  database: typeof db = db,
) {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("POSTGRES_URL is required");
  const selected = databaseTarget(databaseUrl);
  if (options.target !== selected.target) {
    throw new Error(
      `Expected ${options.target} database, found ${selected.target} host ${selected.host}`,
    );
  }
  const origin = supabaseStorageOrigin();
  if (!origin) throw new Error("Could not determine Supabase Storage URL");
  const storageHost = new URL(origin).hostname;
  if (options.apply) {
    const storageTarget = databaseTarget(origin);
    if (storageTarget.target !== options.target) {
      throw new Error("Database and Storage must use the same target");
    }
    const databaseStorageOrigin = supabaseStorageOrigin("", databaseUrl);
    if (selected.target === "production" && origin !== databaseStorageOrigin) {
      throw new Error(
        "Storage must belong to the selected Supabase database project",
      );
    }
  }
  logger.info({
    databaseHost: selected.host,
    storageHost,
    apply: options.apply,
    limit: options.limit,
  });
  const candidates = await database
    .select({
      id: ContentImage.id,
      contentType: ContentImage.contentType,
      contentId: ContentImage.contentId,
      contentHash: ContentImage.contentHash,
      storagePath: ContentImage.storagePath,
      imageHash: ContentImage.imageHash,
      updatedAt: sql<string | null>`${ContentImage.updatedAt}::text`,
    })
    .from(ContentImage)
    .where(sql`${ContentImage.storagePath} !~ '/v1/[a-f0-9]{64}/reader[.]jpg$'`)
    .orderBy(asc(ContentImage.id))
    .limit(options.limit);
  logger.info({
    selected: candidates.length,
    mode: options.apply ? "apply" : "dry-run",
  });
  if (!options.apply) return;

  for (const candidate of candidates) {
    if (
      candidate.contentType !== "bill" &&
      candidate.contentType !== "government_content" &&
      candidate.contentType !== "court_case"
    ) {
      logger.warn({ id: candidate.id, outcome: "unsupported-content-type" });
      continue;
    }
    const url = contentImagePublicUrl(origin, candidate.storagePath);
    if (!url) throw new Error(`Invalid Storage path for ${candidate.id}`);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Original image download failed (${response.status})`);
    const data = Buffer.from(await response.arrayBuffer());
    if (
      createHash("sha256").update(data).digest("hex") !== candidate.imageHash
    ) {
      throw new Error(`Original image checksum mismatch for ${candidate.id}`);
    }
    const stored = await uploadContentImage({
      contentType: candidate.contentType,
      contentId: candidate.contentId,
      data,
    });
    const updated = await database
      .update(ContentImage)
      .set({
        storagePath: stored.path,
        imageHash: stored.hash,
        width: stored.width,
        height: stored.height,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ContentImage.id, candidate.id),
          eq(ContentImage.storagePath, candidate.storagePath),
          eq(ContentImage.imageHash, candidate.imageHash),
          eq(ContentImage.contentHash, candidate.contentHash),
          sql`${ContentImage.updatedAt} is not distinct from ${candidate.updatedAt}::timestamptz`,
        ),
      )
      .returning({ id: ContentImage.id });
    logger.info({
      id: candidate.id,
      outcome: updated.length ? "resized" : "changed-during-resize",
    });
  }
}
