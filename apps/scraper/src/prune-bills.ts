import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { and, eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  BriefChangeImage,
  ContentBrief,
  ContentLens,
  SavedArticle,
  Video,
} from "@acme/db/schema";

import type { BillRetentionCandidate } from "./utils/bill-retention.js";
import { databaseTarget, databaseTargetMessage } from "./env.js";
import {
  retentionJurisdiction,
  selectBillsToEvict,
} from "./utils/bill-retention.js";
import {
  createLogger,
  printFooter,
  printHeader,
  printKeyValue,
} from "./utils/log.js";

const logger = createLogger("bill-retention");
const DELETE_BATCH_SIZE = 500;

interface DeleteCounts {
  bills: number;
  videos: number;
  briefs: number;
  lenses: number;
  saves: number;
  changeImages: number;
}

type RetentionExecutor = Pick<typeof db, "delete" | "select">;

const argv = await yargs(hideBin(process.argv))
  .option("keep-per-jurisdiction", {
    type: "number",
    default: 100,
    description: "Newest bills to retain independently in each jurisdiction",
  })
  .option("apply", {
    type: "boolean",
    default: false,
    description:
      "Delete selected rows; without this flag the command is read-only",
  })
  .option("yes", {
    type: "boolean",
    default: false,
    description: "Acknowledge production deletions",
  })
  .check((args) => {
    const keepPerJurisdiction = args.keepPerJurisdiction;
    if (
      typeof keepPerJurisdiction !== "number" ||
      !Number.isInteger(keepPerJurisdiction) ||
      keepPerJurisdiction < 1
    ) {
      throw new Error("--keep-per-jurisdiction must be a positive integer");
    }
    return true;
  })
  .strict()
  .help()
  .parse();

function batches<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function loadCandidates(
  executor: Pick<typeof db, "select">,
): Promise<BillRetentionCandidate[]> {
  return executor
    .select({
      id: Bill.id,
      billNumber: Bill.billNumber,
      sourceWebsite: Bill.sourceWebsite,
      sourceUpdatedAt: Bill.sourceUpdatedAt,
      lastActionAt: Bill.lastActionAt,
      createdAt: Bill.createdAt,
    })
    .from(Bill);
}

function printSelection(
  candidates: readonly BillRetentionCandidate[],
  selected: ReturnType<typeof selectBillsToEvict>,
) {
  const jurisdictions = new Map<string, { total: number; evict: number }>();
  for (const candidate of candidates) {
    const jurisdiction = retentionJurisdiction(candidate);
    const counts = jurisdictions.get(jurisdiction) ?? { total: 0, evict: 0 };
    counts.total += 1;
    jurisdictions.set(jurisdiction, counts);
  }
  for (const candidate of selected) {
    jurisdictions.get(candidate.jurisdiction)!.evict += 1;
  }

  printHeader("Bill retention inventory");
  for (const [jurisdiction, counts] of [...jurisdictions].sort()) {
    printKeyValue(
      jurisdiction,
      `${counts.total} total; ${counts.evict} selected for eviction`,
    );
  }
  printKeyValue("Selected bills", selected.length);
  printKeyValue("Writes", argv.apply ? "enabled" : "disabled (dry run)");
  printFooter();
}

async function deleteSelected(
  executor: RetentionExecutor,
  ids: string[],
): Promise<DeleteCounts> {
  const counts: DeleteCounts = {
    bills: 0,
    videos: 0,
    briefs: 0,
    lenses: 0,
    saves: 0,
    changeImages: 0,
  };

  for (const batch of batches(ids, DELETE_BATCH_SIZE)) {
    const briefRows = await executor
      .select({ id: ContentBrief.id })
      .from(ContentBrief)
      .where(
        and(
          eq(ContentBrief.contentType, "bill"),
          inArray(ContentBrief.contentId, batch),
        ),
      );
    const briefIds = briefRows.map((row) => row.id);
    if (briefIds.length > 0) {
      counts.changeImages += (
        await executor
          .select({ id: BriefChangeImage.id })
          .from(BriefChangeImage)
          .where(inArray(BriefChangeImage.contentBriefId, briefIds))
      ).length;
    }

    counts.videos += (
      await executor
        .delete(Video)
        .where(
          and(eq(Video.contentType, "bill"), inArray(Video.contentId, batch)),
        )
        .returning({ id: Video.id })
    ).length;
    counts.lenses += (
      await executor
        .delete(ContentLens)
        .where(
          and(
            eq(ContentLens.contentType, "bill"),
            inArray(ContentLens.contentId, batch),
          ),
        )
        .returning({ id: ContentLens.id })
    ).length;
    counts.saves += (
      await executor
        .delete(SavedArticle)
        .where(
          and(
            eq(SavedArticle.contentType, "bill"),
            inArray(SavedArticle.contentId, batch),
          ),
        )
        .returning({ id: SavedArticle.id })
    ).length;
    counts.briefs += (
      await executor
        .delete(ContentBrief)
        .where(
          and(
            eq(ContentBrief.contentType, "bill"),
            inArray(ContentBrief.contentId, batch),
          ),
        )
        .returning({ id: ContentBrief.id })
    ).length;
    counts.bills += (
      await executor
        .delete(Bill)
        .where(inArray(Bill.id, batch))
        .returning({ id: Bill.id })
    ).length;
  }

  return counts;
}

function printResult(counts: DeleteCounts) {
  printHeader("Eviction result");
  printKeyValue("Bills", counts.bills);
  printKeyValue("Feed images", counts.videos);
  printKeyValue("Briefs", counts.briefs);
  printKeyValue("Lenses", counts.lenses);
  printKeyValue("Saved references", counts.saves);
  printKeyValue("Brief change images", counts.changeImages);
  printFooter();
}

async function main() {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("POSTGRES_URL is required");

  const target = databaseTarget(databaseUrl);
  if (argv.apply && target.target === "production" && !argv.yes) {
    throw new Error("Production deletions require both --apply and --yes");
  }
  logger[target.target === "production" ? "warn" : "info"](
    databaseTargetMessage(databaseUrl),
  );

  if (!argv.apply) {
    const candidates = await loadCandidates(db);
    const selected = selectBillsToEvict(candidates, argv.keepPerJurisdiction);
    printSelection(candidates, selected);
    return;
  }

  const counts = await db.transaction(async (tx) => {
    // The supervisor runs one job at a time. Keeping selection and deletion in
    // this transaction also makes a manual invocation atomic: either every
    // polymorphic dependent and bill row is deleted, or none are.
    const candidates = await loadCandidates(tx);
    const selected = selectBillsToEvict(candidates, argv.keepPerJurisdiction);
    printSelection(candidates, selected);
    if (selected.length === 0) {
      return {
        bills: 0,
        videos: 0,
        briefs: 0,
        lenses: 0,
        saves: 0,
        changeImages: 0,
      } satisfies DeleteCounts;
    }

    const deleted = await deleteSelected(
      tx,
      selected.map((row) => row.id),
    );
    if (deleted.bills !== selected.length) {
      throw new Error(
        `Selected ${selected.length} bills but deleted ${deleted.bills}; rolling back`,
      );
    }
    return deleted;
  });

  printResult(counts);
  logger.success(`Evicted ${counts.bills} old bill(s)`);
}

await main();
