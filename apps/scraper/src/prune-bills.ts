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
  .option("active-days", {
    type: "number",
    default: 90,
    description: "Keep bills with activity inside this rolling window",
  })
  .option("top-per-category", {
    type: "number",
    default: 50,
    description:
      "Keep this many popular, controversial, and talked-about bills globally",
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
    const activeDays = args.activeDays;
    const topPerCategory = args.topPerCategory;
    if (
      typeof activeDays !== "number" ||
      !Number.isInteger(activeDays) ||
      activeDays < 1
    ) {
      throw new Error("--active-days must be a positive integer");
    }
    if (
      typeof topPerCategory !== "number" ||
      !Number.isInteger(topPerCategory) ||
      topPerCategory < 1
    ) {
      throw new Error("--top-per-category must be a positive integer");
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
      `${row.total} total; ${row.recent} recent, ${row.unscored} awaiting score, ${row.saved} saved, ${row.popular} popular, ${row.controversial} controversial, ${row.talkedAbout} talked-about; ${row.evict} selected for eviction`,
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

  const policy = {
    activeDays: argv.activeDays,
    topPerCategory: argv.topPerCategory,
  };
  const inventory = await billRetentionInventory(policy);
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

  const results = await enforceBillRetention(jurisdictions, policy);

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
    "Interest assessments",
    results.reduce((total, result) => total + result.interests, 0),
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
