import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill } from "@acme/db/schema";

import { databaseTarget, databaseTargetMessage } from "./env.js";
import {
  fetchCongressActions,
  parseCongressBillUrl,
} from "./scrapers/congress.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("bill-action-sources");

const argv = await yargs(hideBin(process.argv))
  .option("apply", {
    type: "boolean",
    default: false,
    describe: "Write refreshed action metadata; otherwise run read-only",
  })
  .option("confirm-production", {
    type: "boolean",
    default: false,
    describe: "Required with --apply when POSTGRES_URL is not local",
  })
  .option("limit", {
    type: "number",
    describe: "Maximum number of bills to inspect",
  })
  .option("bill", {
    type: "string",
    describe: 'Only inspect one bill number, for example "H.R. 9339"',
  })
  .check((args) => {
    if (
      args.limit !== undefined &&
      (!Number.isInteger(args.limit) || args.limit <= 0)
    ) {
      throw new Error("--limit must be a positive integer");
    }
    return true;
  })
  .help()
  .parse();

async function main() {
  if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is required");
  if (!process.env.CONGRESS_API_KEY) {
    throw new Error("CONGRESS_API_KEY is required");
  }

  const target = databaseTarget(process.env.POSTGRES_URL);
  logger.info(databaseTargetMessage(process.env.POSTGRES_URL));
  if (argv.apply && target.target === "production" && !argv.confirmProduction) {
    throw new Error(
      "Refusing to write to production without --confirm-production",
    );
  }

  const rows = await db
    .select({
      id: Bill.id,
      billNumber: Bill.billNumber,
      actions: Bill.actions,
      url: Bill.url,
      updatedAt: Bill.updatedAt,
    })
    .from(Bill)
    .where(eq(Bill.sourceWebsite, "congress.gov"));

  const candidates = rows
    .filter(
      (row) =>
        (row.actions ?? []).length > 0 &&
        (row.actions ?? []).some((action) => !action.sourceUrl) &&
        (!argv.bill ||
          row.billNumber.toLowerCase() === argv.bill.trim().toLowerCase()),
    )
    .slice(0, argv.limit);

  logger.info(
    `${argv.apply ? "Backfilling" : "Dry-running"} ${candidates.length} bill(s) with unsourced actions`,
  );

  let updatedBills = 0;
  let updatedEvents = 0;
  let skippedBills = 0;

  for (const row of candidates) {
    const locator = parseCongressBillUrl(row.url);
    if (!locator) {
      skippedBills += 1;
      logger.warn(`${row.billNumber}: unsupported Congress.gov URL`);
      continue;
    }

    const actions = await fetchCongressActions(
      locator.congress,
      locator.billType,
      locator.billNumber,
      row.url,
    );
    if (actions.length === 0) {
      skippedBills += 1;
      logger.warn(`${row.billNumber}: Congress.gov returned no actions`);
      continue;
    }

    const sourcedEvents = actions.filter((action) => action.sourceUrl).length;
    logger.info(
      `${row.billNumber}: ${actions.length} actions, ${sourcedEvents} sourced`,
    );

    if (argv.apply) {
      await db
        .update(Bill)
        // Preserve the ingestion watermark: Bill.updatedAt is currently used
        // to calculate Congress.gov's next incremental fromDateTime.
        .set({ actions, updatedAt: row.updatedAt })
        .where(eq(Bill.id, row.id));
    }
    updatedBills += 1;
    updatedEvents += sourcedEvents;
  }

  logger.success(
    `${argv.apply ? "Updated" : "Would update"} ${updatedBills} bill(s) / ${updatedEvents} event(s); skipped ${skippedBills}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("Bill action source backfill failed", error);
    process.exit(1);
  });
