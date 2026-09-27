import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { runFollowNotifications } from "@acme/api/lib/notifications";

import { createLogger } from "./utils/log.js";

const logger = createLogger("notify-followers");

const argv = await yargs(hideBin(process.argv))
  .option("dry-run", {
    alias: "d",
    type: "boolean",
    default: false,
    describe: "Print the run without sending Expo pushes",
  })
  .parse();

if (argv.dryRun) {
  logger.info("dry-run: would enqueue follow moves and drain the outbox");
  process.exit(0);
}

const result = await runFollowNotifications();
logger.info(
  `enqueued ${result.enqueued}, sent ${result.sent}, failed ${result.failed}, unregistered ${result.unregistered}; receipts checked ${result.receipts.checked}, failed ${result.receipts.failed}, unregistered ${result.receipts.unregistered}`,
);
