/**
 * Backfill structured briefs for bills that predate the brief pipeline, or
 * whose brief is stale relative to the bill's current contentHash.
 *
 * The analysis pass is cached independently from the reader-facing brief, so
 * a brief-schema update can reuse an unchanged bill's section notes. Quotes
 * are still verified against the complete official text.
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNotNull, isNull, ne, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, ContentBrief } from "@acme/db/schema";
import { BILL_BRIEF_VERSION } from "@acme/validators";

import { AIRateLimitError } from "./utils/ai/text-generation.js";
import { upsertBillBrief } from "./utils/db/operations.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("brief-backfill");

interface BriefCandidate {
  id: string;
  contentHash: string;
  title: string;
  billNumber: string;
  url: string;
  fullText: string;
  status: string | null;
  summary: string | null;
  aiGeneratedArticle: string | null;
}

async function findBills(limit: number): Promise<BriefCandidate[]> {
  const rows = await db
    .select({
      id: Bill.id,
      contentHash: Bill.contentHash,
      title: Bill.title,
      billNumber: Bill.billNumber,
      url: Bill.url,
      fullText: Bill.fullText,
      status: Bill.status,
      summary: Bill.summary,
      aiGeneratedArticle: Bill.aiGeneratedArticle,
    })
    .from(Bill)
    .leftJoin(
      ContentBrief,
      and(
        eq(ContentBrief.contentType, "bill"),
        eq(ContentBrief.contentId, Bill.id),
      ),
    )
    .where(
      and(
        isNotNull(Bill.fullText),
        or(
          isNull(ContentBrief.id),
          ne(ContentBrief.contentHash, Bill.contentHash),
          sql`${ContentBrief.brief}->>'version' IS DISTINCT FROM ${String(BILL_BRIEF_VERSION)}`,
        ),
      ),
    )
    .orderBy(desc(Bill.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText ? [{ ...row, fullText: row.fullText }] : [],
  );
}

const argv = await yargs(hideBin(process.argv))
  .option("limit", {
    alias: "l",
    type: "number",
    default: 10,
    describe: "Maximum missing/stale briefs to process",
  })
  .option("dry-run", {
    alias: "d",
    type: "boolean",
    default: false,
    describe: "List candidates without generating briefs",
  })
  .check((args) =>
    Number.isInteger(args.limit) && args.limit > 0
      ? true
      : "--limit must be a positive integer",
  )
  .strict()
  .help()
  .parse();

const candidates = await findBills(argv.limit);
logger.info(`Found ${candidates.length} missing/stale bill brief candidate(s)`);

let processed = 0;
let failed = 0;

for (const candidate of candidates) {
  if (argv.dryRun) {
    logger.info(`[dry run] ${candidate.billNumber}: ${candidate.title}`);
    continue;
  }

  try {
    const generated = await upsertBillBrief({
      contentId: candidate.id,
      contentHash: candidate.contentHash,
      title: candidate.title,
      billNumber: candidate.billNumber,
      url: candidate.url,
      fullText: candidate.fullText,
      status: candidate.status,
      summary: candidate.summary,
      priorArticle: candidate.aiGeneratedArticle,
    });
    if (generated) processed++;
    else failed++;
  } catch (error) {
    // A rate limit means every remaining candidate would fail the same way.
    if (error instanceof AIRateLimitError) {
      logger.warn("LLM rate limit hit — stopping backfill early");
      break;
    }
    failed++;
    logger.error(`Failed brief for ${candidate.billNumber}`, error);
  }
}

logger.info(
  argv.dryRun
    ? "Brief backfill dry run completed"
    : `Brief backfill completed: ${processed} processed, ${failed} failed`,
);

if (failed > 0) process.exitCode = 1;
