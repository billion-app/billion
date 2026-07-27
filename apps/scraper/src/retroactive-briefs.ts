/**
 * Backfill structured briefs for bills, court cases, and government actions
 * that predate the brief pipeline or have stale source content.
 *
 * Mirrors `retroactive-lenses.ts`. Existing long-form analysis is passed to
 * the content-specific generator as context, while quotes are still verified
 * against the official text.
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, inArray, isNotNull, isNull, ne, or } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentBrief,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import { AIRateLimitError } from "./utils/ai/text-generation.js";
import {
  upsertBillBrief,
  upsertCourtCaseBrief,
  upsertGovernmentActionBrief,
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

interface GovernmentBriefCandidate {
  type: "government_content";
  id: string;
  contentHash: string;
  title: string;
  documentType: string;
  description: string | null;
  fullText: string;
  aiGeneratedArticle: string | null;
}

type BriefCandidate =
  | BillBriefCandidate
  | CourtBriefCandidate
  | GovernmentBriefCandidate;

function candidateIdentifier(candidate: BriefCandidate): string {
  if (candidate.type === "bill") return candidate.billNumber;
  if (candidate.type === "court_case") return candidate.caseNumber;
  return candidate.documentType;
}

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

async function findGovernmentContent(
  limit: number,
): Promise<GovernmentBriefCandidate[]> {
  const rows = await db
    .select({
      id: GovernmentContent.id,
      contentHash: GovernmentContent.contentHash,
      title: GovernmentContent.title,
      documentType: GovernmentContent.type,
      description: GovernmentContent.description,
      fullText: GovernmentContent.fullText,
      aiGeneratedArticle: GovernmentContent.aiGeneratedArticle,
    })
    .from(GovernmentContent)
    .leftJoin(
      ContentBrief,
      and(
        eq(ContentBrief.contentType, "government_content"),
        eq(ContentBrief.contentId, GovernmentContent.id),
      ),
    )
    .where(
      and(
        isNotNull(GovernmentContent.fullText),
        inArray(GovernmentContent.type, [
          "Executive Order",
          "Memorandum",
          "Proclamation",
          "Presidential Proclamation",
        ]),
        or(
          isNull(ContentBrief.id),
          ne(ContentBrief.contentHash, GovernmentContent.contentHash),
        ),
      ),
    )
    .orderBy(desc(GovernmentContent.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText
      ? [
          {
            ...row,
            type: "government_content" as const,
            fullText: row.fullText,
          },
        ]
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
    choices: ["bill", "court_case", "government_content", "all"] as const,
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
  ...(argv.type === "all" || argv.type === "bill"
    ? await findBills(argv.limit)
    : []),
  ...(argv.type === "all" || argv.type === "court_case"
    ? await findCourtCases(argv.limit)
    : []),
  ...(argv.type === "all" || argv.type === "government_content"
    ? await findGovernmentContent(argv.limit)
    : []),
].slice(0, argv.limit);
logger.info(`Found ${candidates.length} missing/stale brief candidate(s)`);

let processed = 0;
let failed = 0;

for (const candidate of candidates) {
  if (argv.dryRun) {
    logger.info(
      `[dry run] ${candidateIdentifier(candidate)}: ${candidate.title}`,
    );
    continue;
  }

  try {
    let generated: boolean;
    if (candidate.type === "bill") {
      generated = await upsertBillBrief({
        contentId: candidate.id,
        contentHash: candidate.contentHash,
        title: candidate.title,
        billNumber: candidate.billNumber,
        url: candidate.url,
        fullText: candidate.fullText,
        status: candidate.status,
        priorArticle: candidate.aiGeneratedArticle,
      });
    } else if (candidate.type === "court_case") {
      generated = await upsertCourtCaseBrief({
        contentId: candidate.id,
        contentHash: candidate.contentHash,
        title: candidate.title,
        court: candidate.court,
        caseNumber: candidate.caseNumber,
        fullText: candidate.fullText,
        status: candidate.status,
        priorArticle: candidate.aiGeneratedArticle,
      });
    } else {
      generated = await upsertGovernmentActionBrief({
        contentId: candidate.id,
        contentHash: candidate.contentHash,
        title: candidate.title,
        documentType: candidate.documentType,
        description: candidate.description,
        fullText: candidate.fullText,
        priorArticle: candidate.aiGeneratedArticle,
      });
    }
    if (generated) processed++;
    else failed++;
  } catch (error) {
    // A rate limit means every remaining candidate would fail the same way.
    if (error instanceof AIRateLimitError) {
      logger.warn("LLM rate limit hit — stopping backfill early");
      break;
    }
    failed++;
    logger.error(`Failed brief for ${candidateIdentifier(candidate)}`, error);
  }
}

logger.info(
  argv.dryRun
    ? "Brief backfill dry run completed"
    : `Brief backfill completed: ${processed} processed, ${failed} failed`,
);

if (failed > 0) process.exitCode = 1;
