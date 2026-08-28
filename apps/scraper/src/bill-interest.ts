import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNull, ne, or } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, BillInterest, ContentBrief, ContentLens } from "@acme/db/schema";

import { generateBillInterest } from "./utils/ai/bill-interest.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("bill-interest");

const argv = await yargs(hideBin(process.argv))
  .option("limit", {
    alias: "l",
    type: "number",
    default: 200,
    describe: "Maximum missing or stale bill assessments to generate",
  })
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 4,
    describe: "Assessments to generate in parallel",
  })
  .option("dry-run", {
    alias: "d",
    type: "boolean",
    default: false,
    describe: "List candidates without calling the model or writing",
  })
  .check((args) =>
    Number.isInteger(args.limit) && args.limit > 0
      ? true
      : "--limit must be a positive integer",
  )
  .check((args) =>
    Number.isInteger(args.concurrency) && args.concurrency > 0
      ? true
      : "--concurrency must be a positive integer",
  )
  .strict()
  .help()
  .parse();

const candidates = await db
  .select({
    id: Bill.id,
    contentHash: Bill.contentHash,
    billNumber: Bill.billNumber,
    title: Bill.title,
    description: Bill.description,
    summary: Bill.summary,
    status: Bill.status,
    brief: ContentBrief.brief,
    lens: ContentLens.lensData,
  })
  .from(Bill)
  .leftJoin(BillInterest, eq(BillInterest.billId, Bill.id))
  .leftJoin(
    ContentBrief,
    and(
      eq(ContentBrief.contentType, "bill"),
      eq(ContentBrief.contentId, Bill.id),
    ),
  )
  .leftJoin(
    ContentLens,
    and(
      eq(ContentLens.contentType, "bill"),
      eq(ContentLens.contentId, Bill.id),
    ),
  )
  .where(
    or(
      isNull(BillInterest.billId),
      ne(BillInterest.contentHash, Bill.contentHash),
    ),
  )
  .orderBy(
    desc(Bill.lastActionAt),
    desc(Bill.sourceUpdatedAt),
    desc(Bill.createdAt),
  )
  .limit(argv.limit);

logger.info(`Found ${candidates.length} missing/stale assessment candidate(s)`);

const limit = pLimit(argv.concurrency);
let processed = 0;
let failed = 0;

await Promise.all(
  candidates.map((candidate) =>
    limit(async () => {
      if (argv.dryRun) {
        logger.info(`[dry run] ${candidate.billNumber}: ${candidate.title}`);
        return;
      }

      try {
        const assessment = await generateBillInterest(candidate);
        await db
          .insert(BillInterest)
          .values({
            billId: candidate.id,
            contentHash: candidate.contentHash,
            interestScore: assessment.interestScore,
            controversyScore: assessment.controversyScore,
            attentionScore: assessment.attentionScore,
            reason: assessment.reason,
            modelVersion: assessment.modelVersion,
          })
          .onConflictDoUpdate({
            target: BillInterest.billId,
            set: {
              contentHash: candidate.contentHash,
              interestScore: assessment.interestScore,
              controversyScore: assessment.controversyScore,
              attentionScore: assessment.attentionScore,
              reason: assessment.reason,
              modelVersion: assessment.modelVersion,
              generatedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        processed += 1;
        logger.success(
          `${candidate.billNumber}: interest ${assessment.interestScore}, controversy ${assessment.controversyScore}, attention ${assessment.attentionScore}`,
        );
      } catch (error) {
        failed += 1;
        logger.error(`Failed assessment for ${candidate.billNumber}`, error);
      }
    }),
  ),
);

logger.info(
  argv.dryRun
    ? "Bill-interest dry run completed"
    : `Bill-interest run completed: ${processed} processed, ${failed} failed`,
);

if (failed > 0) process.exitCode = 1;
