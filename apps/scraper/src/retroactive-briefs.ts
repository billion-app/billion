/**
 * Backfill structured briefs for bills that predate the brief pipeline, or
 * whose brief is stale relative to the bill's current contentHash.
 *
 * Mirrors `retroactive-lenses.ts`. Bills already carry a vetted long-form
 * article, so the backfill hands that to the generator as prior analysis —
 * the restructuring pass is cheaper and more consistent than re-reading the
 * statute cold, and quotes are still verified against the official text.
 */
import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNotNull, isNull, ne, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, ContentBrief } from "@acme/db/schema";
import { BILL_ANALYSIS_SCHEMA_VERSION } from "@acme/validators";

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
  summary: string | null;
  status: string | null;
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
      summary: Bill.summary,
      status: Bill.status,
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
          sql`${ContentBrief.brief}->>'analysisSchemaVersion' is distinct from ${BILL_ANALYSIS_SCHEMA_VERSION}`,
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
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 1,
    describe: "Briefs to generate in parallel",
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

const candidates = await findBills(argv.limit);
logger.info(`Found ${candidates.length} missing/stale bill brief candidate(s)`);

let processed = 0;
let failed = 0;
// A rate limit means every remaining candidate would fail the same way, so the
// sequential version broke out of the loop. Concurrently there is no loop to
// break: in-flight work has to finish and anything not yet started is skipped.
let rateLimited = false;

const limit = pLimit(argv.concurrency);

await Promise.all(
  candidates.map((candidate) =>
    limit(async () => {
      if (argv.dryRun) {
        logger.info(`[dry run] ${candidate.billNumber}: ${candidate.title}`);
        return;
      }
      if (rateLimited) return;

      try {
        const generated = await upsertBillBrief({
          contentId: candidate.id,
          contentHash: candidate.contentHash,
          title: candidate.title,
          billNumber: candidate.billNumber,
          url: candidate.url,
          fullText: candidate.fullText,
          officialSummary: candidate.summary,
          status: candidate.status,
          priorArticle: candidate.aiGeneratedArticle,
        });
        if (generated) processed++;
        else failed++;
      } catch (error) {
        if (error instanceof AIRateLimitError) {
          if (!rateLimited) {
            logger.warn("LLM rate limit hit — skipping remaining candidates");
          }
          rateLimited = true;
          return;
        }
        failed++;
        logger.error(`Failed brief for ${candidate.billNumber}`, error);
      }
    }),
  ),
);

logger.info(
  argv.dryRun
    ? "Brief backfill dry run completed"
    : `Brief backfill completed: ${processed} processed, ${failed} failed`,
);

if (failed > 0) process.exitCode = 1;
