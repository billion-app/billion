import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { desc, isNotNull } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CourtCase, GovernmentContent } from "@acme/db/schema";

import { upsertContentLens } from "./utils/db/operations.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("lens-backfill");

/**
 * Candidate selection deliberately does not test freshness.
 *
 * `upsertContentLens` keys its cache on what the lens actually reads —
 * `hash(title + fullText + articleType + modelVersion)` — precisely so a routine
 * status change ("Referred to committee" -> "Received in the Senate") does not
 * pay for a fresh agentic research loop. That key is not the content's
 * `contentHash`, and SQL cannot compute it.
 *
 * These queries used to select `ContentLens.contentHash != <content>.contentHash`
 * anyway, comparing two hashes that can never match. Every correctly-keyed lens
 * therefore read as stale: on 2026-07-30 that offered 682 candidates when only 6
 * were genuinely missing, and a run regenerated ~10 good lenses before it was
 * stopped. That is not merely wasted spend — the lens is nondeterministic and
 * overwritten in place, so a needless regeneration is a coin flip on losing a
 * better result.
 *
 * So the backfill now offers everything with source text and lets
 * `upsertContentLens` decide, since it owns the definition of fresh and already
 * short-circuits on a hit for the cost of one indexed read and no LLM call.
 */

const CONTENT_TYPES = ["bill", "government_content", "court_case"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

interface LensCandidate {
  id: string;
  contentType: ContentType;
  contentHash: string;
  title: string;
  fullText: string;
  articleType: string;
  aiGeneratedArticle: string | null;
}

async function findBills(limit: number): Promise<LensCandidate[]> {
  const rows = await db
    .select({
      id: Bill.id,
      contentHash: Bill.contentHash,
      title: Bill.title,
      fullText: Bill.fullText,
      aiGeneratedArticle: Bill.aiGeneratedArticle,
    })
    .from(Bill)
    .where(isNotNull(Bill.fullText))
    .orderBy(desc(Bill.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText
      ? [
          {
            ...row,
            contentType: "bill" as const,
            fullText: row.fullText,
            articleType: "bill",
          },
        ]
      : [],
  );
}

async function findGovernmentContent(limit: number): Promise<LensCandidate[]> {
  const rows = await db
    .select({
      id: GovernmentContent.id,
      contentHash: GovernmentContent.contentHash,
      title: GovernmentContent.title,
      fullText: GovernmentContent.fullText,
      articleType: GovernmentContent.type,
      aiGeneratedArticle: GovernmentContent.aiGeneratedArticle,
    })
    .from(GovernmentContent)
    .where(isNotNull(GovernmentContent.fullText))
    .orderBy(desc(GovernmentContent.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText
      ? [
          {
            ...row,
            contentType: "government_content" as const,
            fullText: row.fullText,
          },
        ]
      : [],
  );
}

async function findCourtCases(limit: number): Promise<LensCandidate[]> {
  const rows = await db
    .select({
      id: CourtCase.id,
      contentHash: CourtCase.contentHash,
      title: CourtCase.title,
      fullText: CourtCase.fullText,
      aiGeneratedArticle: CourtCase.aiGeneratedArticle,
    })
    .from(CourtCase)
    .where(isNotNull(CourtCase.fullText))
    .orderBy(desc(CourtCase.createdAt))
    .limit(limit);

  return rows.flatMap((row) =>
    row.fullText
      ? [
          {
            ...row,
            contentType: "court_case" as const,
            fullText: row.fullText,
            articleType: "court case",
          },
        ]
      : [],
  );
}

const finders: Record<
  ContentType,
  (limit: number) => Promise<LensCandidate[]>
> = {
  bill: findBills,
  government_content: findGovernmentContent,
  court_case: findCourtCases,
};

const argv = await yargs(hideBin(process.argv))
  .option("type", {
    alias: "t",
    choices: [...CONTENT_TYPES, "all"] as const,
    default: "all" as const,
    describe: "Content type to backfill",
  })
  .option("limit", {
    alias: "l",
    type: "number",
    default: 10,
    describe: "Maximum missing/stale lenses to process per selected type",
  })
  .option("dry-run", {
    alias: "d",
    type: "boolean",
    default: false,
    describe: "List candidates without generating lenses",
  })
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 1,
    describe: "Lenses to generate in parallel",
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

const selectedTypes: ContentType[] =
  argv.type === "all" ? [...CONTENT_TYPES] : [argv.type];

let processed = 0;
let failed = 0;

const limit = pLimit(argv.concurrency);

for (const contentType of selectedTypes) {
  const candidates = await finders[contentType](argv.limit);
  logger.info(
    `Found ${candidates.length} missing/stale ${contentType} lens candidate(s)`,
  );

  await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        if (argv.dryRun) {
          logger.info(`[dry run] ${contentType}: ${candidate.title}`);
          return;
        }

        try {
          const generated = await upsertContentLens(
            candidate.id,
            candidate.contentType,
            candidate.contentHash,
            candidate.title,
            candidate.fullText,
            candidate.articleType,
            candidate.aiGeneratedArticle,
          );
          if (generated) processed++;
          else failed++;
        } catch (error) {
          failed++;
          logger.error(`Failed ${contentType} lens for ${candidate.id}`, error);
        }
      }),
    ),
  );
}

logger.info(
  argv.dryRun
    ? "Dual-lens backfill dry run completed"
    : `Dual-lens backfill completed: ${processed} processed, ${failed} failed`,
);

if (failed > 0) process.exitCode = 1;
