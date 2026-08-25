import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { databaseTarget, databaseTargetMessage } from "./env.js";
import {
  billRetentionInventory,
  enforceBillRetention,
} from "./utils/bill-retention.js";
import {
  createLogger,
  printFooter,
  printHeader,
  printKeyValue,
} from "./utils/log.js";

const logger = createLogger("bill-retention");

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

function printInventory(
  inventory: Awaited<ReturnType<typeof billRetentionInventory>>,
) {
  printHeader("Bill retention inventory");
  for (const row of inventory) {
    printKeyValue(
      row.jurisdiction,
      `${row.total} total; ${row.evict} selected for eviction`,
    );
  }
  printKeyValue(
    "Selected bills",
    inventory.reduce((total, row) => total + row.evict, 0),
  );
  printKeyValue("Writes", argv.apply ? "enabled" : "disabled (dry run)");
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

  const inventory = await billRetentionInventory(argv.keepPerJurisdiction);
  printInventory(inventory);
  if (!argv.apply) return;

  const jurisdictions = inventory
    .filter((row) => row.evict > 0 && /^(US|[A-Z]{2})$/.test(row.jurisdiction))
    .map((row) => row.jurisdiction);
  const ignored = inventory.filter(
    (row) => row.evict > 0 && !/^(US|[A-Z]{2})$/.test(row.jurisdiction),
  );
  for (const row of ignored) {
    logger.warn(
      `Skipping malformed jurisdiction ${row.jurisdiction} (${row.evict} bill(s))`,
    );
  }

  const results = await enforceBillRetention(
    jurisdictions,
    argv.keepPerJurisdiction,
  );

  printHeader("Eviction result");
  for (const result of results) {
    printKeyValue(result.jurisdiction, `${result.bills} bills`);
  }
  printKeyValue(
    "Bills",
    results.reduce((total, result) => total + result.bills, 0),
  );
  printKeyValue(
    "Briefs",
    results.reduce((total, result) => total + result.briefs, 0),
  );
  printKeyValue(
    "Lenses",
    results.reduce((total, result) => total + result.lenses, 0),
  );
  printKeyValue(
    "Saved references",
    results.reduce((total, result) => total + result.saves, 0),
  );
  printKeyValue(
    "Brief change images",
    results.reduce((total, result) => total + result.changeImages, 0),
  );
  printFooter();
  logger.success(
    `Evicted ${results.reduce((total, result) => total + result.bills, 0)} old bill(s)`,
  );
}

await main();
