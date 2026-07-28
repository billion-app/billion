import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, desc, eq, isNotNull, isNull, ne, or } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentLens,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import { upsertContentLens } from "./utils/db/operations.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("lens-backfill");

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
    .leftJoin(
      ContentLens,
      and(
        eq(ContentLens.contentType, "bill"),
        eq(ContentLens.contentId, Bill.id),
      ),
    )
    .where(
      and(
        isNotNull(Bill.fullText),
        or(
          isNull(ContentLens.id),
          ne(ContentLens.contentHash, Bill.contentHash),
        ),
      ),
    )
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
    .leftJoin(
      ContentLens,
      and(
        eq(ContentLens.contentType, "government_content"),
        eq(ContentLens.contentId, GovernmentContent.id),
      ),
    )
    .where(
      and(
        isNotNull(GovernmentContent.fullText),
        or(
          isNull(ContentLens.id),
          ne(ContentLens.contentHash, GovernmentContent.contentHash),
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
    .leftJoin(
      ContentLens,
      and(
        eq(ContentLens.contentType, "court_case"),
        eq(ContentLens.contentId, CourtCase.id),
      ),
    )
    .where(
      and(
        isNotNull(CourtCase.fullText),
        or(
          isNull(ContentLens.id),
          ne(ContentLens.contentHash, CourtCase.contentHash),
        ),
      ),
    )
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
