import { setTimeout } from "node:timers/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  createTranslateBatch,
  TRANSLATION_PROMPT_VERSION,
} from "@acme/api/lib/content-translation";
import { processNextTranslation } from "@acme/api/lib/content-translation-store";
import {
  prepareReaderTranslationPage,
  readerPreparationHasCapacity,
} from "@acme/api/lib/pretranslate-readers";

import { getStructuredLlmCandidates } from "./utils/ai/provider";

const args = await yargs(hideBin(process.argv))
  .option("limit", {
    type: "number",
    default: 5,
    description: "Maximum requests in a one-off run (1–20)",
  })
  .option("watch", {
    type: "boolean",
    default: false,
    description: "Serve queued translations continuously",
  })
  .option("prepare-only", {
    type: "boolean",
    default: false,
    description:
      "Queue one bounded page of complete Chinese readers without generating",
  })
  .option("after", {
    type: "string",
    description: "Resume preparation after this content UUID",
  })
  .strict()
  .parse();
if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) {
  throw new Error("--limit must be an integer from 1 to 20");
}
if (args.after && !/^[a-f0-9-]{36}$/.test(args.after))
  throw new Error("Invalid --after UUID");
if (args.prepareOnly) {
  console.log(
    JSON.stringify(
      await prepareReaderTranslationPage({
        limit: args.limit,
        after: args.after,
      }),
    ),
  );
  process.exit(0);
}
let preparationAfter: string | undefined;
let nextPreparationAt = 0;
// Reuse the scraper's Responses adapter, but never fall through to paid providers.
const codex = getStructuredLlmCandidates().find((candidate) =>
  candidate.modelVersion.startsWith("fallback:"),
);
if (!codex)
  throw new Error(
    "Translation worker requires SCRAPER_FALLBACK_BASE_URL (private Codex proxy)",
  );
const modelVersion =
  `${TRANSLATION_PROMPT_VERSION}:${codex.modelVersion}`.slice(0, 80);
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log(
  `[content-translations] started ${modelVersion}; watch=${args.watch}`,
);
try {
  for (
    let count = 0;
    !stopping && (args.watch || count < args.limit);
    count++
  ) {
    if (
      args.watch &&
      Date.now() >= nextPreparationAt &&
      (await readerPreparationHasCapacity())
    ) {
      const page = await prepareReaderTranslationPage({
        limit: 10,
        after: preparationAfter,
      });
      preparationAfter = page.complete ? undefined : page.after;
      nextPreparationAt = Date.now() + (page.complete ? 60_000 : 0);
      console.log(`[content-translations] prepared ${JSON.stringify(page)}`);
    }
    const result = await processNextTranslation({
      translateBatch: createTranslateBatch(
        codex.model,
        AbortSignal.timeout(10 * 60_000),
      ),
      modelVersion,
    });
    if (result !== "idle") console.log(`[content-translations] ${result}`);
    if (result === "idle") {
      if (!args.watch) break;
      await setTimeout(5000);
    }
  }
  process.exit(0);
} catch {
  console.error(
    "[content-translations] worker stopped after a database or configuration failure",
  );
  process.exit(1);
}
