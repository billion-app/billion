/**
 * Backfill structured briefs for bills and court cases that predate the brief
 * pipeline, or whose brief is stale relative to the source contentHash.
 *
 * Mirrors `retroactive-lenses.ts`. Existing long-form analysis is passed to
 * the content-specific generator as context, while quotes are still verified
 * against the official text.
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNotNull, isNull, ne, or } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, ContentBrief, CourtCase } from "@acme/db/schema";

import { AIRateLimitError } from "./utils/ai/text-generation.js";
import {
  upsertBillBrief,
  upsertCourtCaseBrief,
} from "./utils/db/operations.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("brief-backfill");

interface BillBriefCandidate {
  type: "bill";
  id: string;
  contentHash: string;
  title: string;
  billNumber: string;
  url: string;
  fullText: string;
  status: string | null;
  aiGeneratedArticle: string | null;
}

interface CourtBriefCandidate {
  type: "court_case";
  id: string;
  contentHash: string;
  title: string;
  court: string;
  caseNumber: string;
  fullText: string;
  status: string | null;
  aiGeneratedArticle: string | null;
}

type BriefCandidate = BillBriefCandidate | CourtBriefCandidate;

async function findBills(limit: number): Promise<BillBriefCandidate[]> {
  const rows = await db
    .select({
      id: Bill.id,
      contentHash: Bill.contentHash,
      title: Bill.title,
      billNumber: Bill.billNumber,
      url: Bill.url,
      fullText: Bill.fullText,
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
        ),
      ),
    )
    .orderBy(desc(Bill.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText
      ? [{ ...row, type: "bill" as const, fullText: row.fullText }]
      : [],
  );
}

async function findCourtCases(limit: number): Promise<CourtBriefCandidate[]> {
  const rows = await db
    .select({
      id: CourtCase.id,
      contentHash: CourtCase.contentHash,
      title: CourtCase.title,
      court: CourtCase.court,
      caseNumber: CourtCase.caseNumber,
      fullText: CourtCase.fullText,
      status: CourtCase.status,
      aiGeneratedArticle: CourtCase.aiGeneratedArticle,
    })
    .from(CourtCase)
    .leftJoin(
      ContentBrief,
      and(
        eq(ContentBrief.contentType, "court_case"),
        eq(ContentBrief.contentId, CourtCase.id),
      ),
    )
    .where(
      and(
        isNotNull(CourtCase.fullText),
        or(
          isNull(ContentBrief.id),
          ne(ContentBrief.contentHash, CourtCase.contentHash),
        ),
      ),
    )
    .orderBy(desc(CourtCase.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText
      ? [{ ...row, type: "court_case" as const, fullText: row.fullText }]
      : [],
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
  .option("type", {
    choices: ["bill", "court_case", "all"] as const,
    default: "all" as const,
    describe: "Content type to backfill",
  })
  .check((args) =>
    Number.isInteger(args.limit) && args.limit > 0
      ? true
      : "--limit must be a positive integer",
  )
  .strict()
  .help()
  .parse();

const candidates: BriefCandidate[] = [
  ...(argv.type === "court_case" ? [] : await findBills(argv.limit)),
  ...(argv.type === "bill" ? [] : await findCourtCases(argv.limit)),
].slice(0, argv.limit);
logger.info(`Found ${candidates.length} missing/stale brief candidate(s)`);

let processed = 0;
let failed = 0;

for (const candidate of candidates) {
  if (argv.dryRun) {
    const identifier =
      candidate.type === "bill" ? candidate.billNumber : candidate.caseNumber;
    logger.info(`[dry run] ${identifier}: ${candidate.title}`);
    continue;
  }

  try {
    const generated =
      candidate.type === "bill"
        ? await upsertBillBrief({
            contentId: candidate.id,
            contentHash: candidate.contentHash,
            title: candidate.title,
            billNumber: candidate.billNumber,
            url: candidate.url,
            fullText: candidate.fullText,
            status: candidate.status,
            priorArticle: candidate.aiGeneratedArticle,
          })
        : await upsertCourtCaseBrief({
            contentId: candidate.id,
            contentHash: candidate.contentHash,
            title: candidate.title,
            court: candidate.court,
            caseNumber: candidate.caseNumber,
            fullText: candidate.fullText,
            status: candidate.status,
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
    const identifier =
      candidate.type === "bill" ? candidate.billNumber : candidate.caseNumber;
    logger.error(`Failed brief for ${identifier}`, error);
  }
}

logger.info(
  argv.dryRun
    ? "Brief backfill dry run completed"
    : `Brief backfill completed: ${processed} processed, ${failed} failed`,
);

if (failed > 0) process.exitCode = 1;
