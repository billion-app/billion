import pLimit from "p-limit";
import sharp from "sharp";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNull, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentImage,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import {
  CONTENT_IMAGE_STYLE_VERSION,
  planContentVisual,
  renderContentImagePrompt,
  versionContentImageHash,
} from "./utils/ai/content-image-visual.js";
import { generateLocalPhoto } from "./utils/ai/image-generation.js";
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
    .where(
      or(
        isNull(ContentImage.id),
        sql`${ContentImage.contentHash} <> md5(${`${CONTENT_IMAGE_STYLE_VERSION}:`} || ${Bill.contentHash})`,
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
    .where(
      or(
        isNull(ContentImage.id),
        sql`${ContentImage.contentHash} <> md5(${`${CONTENT_IMAGE_STYLE_VERSION}:`} || ${GovernmentContent.contentHash})`,
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
    .where(
      or(
        isNull(ContentImage.id),
        sql`${ContentImage.contentHash} <> md5(${`${CONTENT_IMAGE_STYLE_VERSION}:`} || ${CourtCase.contentHash})`,
      ),
    )
    .orderBy(desc(CourtCase.filedDate), desc(CourtCase.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, type: "court_case" }));
}

async function generate(item: Candidate): Promise<void> {
  const plan = await planContentVisual(item);
  const prompt = renderContentImagePrompt(plan);
  const generated = await generateLocalPhoto(prompt, 1024, 768);
  if (!generated) throw new Error("Local FLUX returned no image");
  const data = await sharp(generated.data)
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  const stored = await uploadContentImage({
    contentType: item.type,
    contentId: item.id,
    data,
  });
  const values = {
    contentType: item.type,
    contentId: item.id,
    contentHash: versionContentImageHash(item.contentHash),
    storagePath: stored.path,
    imageHash: stored.hash,
    prompt,
    width: 1024,
    height: 768,
    updatedAt: new Date(),
  };
  await db
    .insert(ContentImage)
    .values(values)
    .onConflictDoUpdate({
      target: [ContentImage.contentType, ContentImage.contentId],
      set: values,
    });
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
  .strict()
  .parseAsync();

if (argv.billLimit < 0 || argv.billLimit > 80) {
  throw new Error("--bill-limit must be between 0 and 80");
}
if (argv.otherLimit < 0 || argv.otherLimit > 50) {
  throw new Error("--other-limit must be between 0 and 50");
}
if (argv.concurrency < 1 || argv.concurrency > 2) {
  throw new Error("--concurrency must be 1 or 2");
}

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

let completed = 0;
let failed = 0;
const limit = pLimit(argv.concurrency);
await Promise.all(
  candidates.map((item) =>
    limit(async () => {
      try {
        await generate(item);
        completed += 1;
        logger.success(
          `${completed}/${candidates.length} ${item.type}:${item.id}`,
        );
      } catch (error) {
        failed += 1;
        logger.warn(`Failed ${item.type}:${item.id}`, error);
      }
    }),
  ),
);
logger.info(`Done: generated=${completed} failed=${failed}`);
if (failed > 0) process.exitCode = 1;
