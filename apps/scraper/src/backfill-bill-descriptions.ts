// Backfills Bill.description for rows where it's null/empty — this is the
// "gist" line shown on bill cards in the app, and it's blank whenever a bill
// was scraped before congress.gov published a CRS summary and full text.
// Prefers the real congress.gov summary if one has since appeared; falls
// back to an AI summary generated from the bill's full text.

import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { eq, isNull, or } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill } from "@acme/db/schema";

import { databaseTarget, databaseTargetMessage } from "./env.js";
import {
  fetchFullText,
  fetchSummary,
  parseBillUrl,
} from "./scrapers/congress.js";
import {
  AIRateLimitError,
  generateAISummary,
} from "./utils/ai/text-generation.js";
import { getCostSummary, resetCosts } from "./utils/costs.js";
import {
  createLogger,
  printFooter,
  printHeader,
  printKeyValue,
} from "./utils/log.js";

const logger = createLogger("bill-descriptions");

interface Candidate {
  id: string;
  billNumber: string;
  title: string;
  congress: number | null;
  url: string;
  fullText: string | null;
}
type Outcome = "congress-summary" | "ai-summary" | "skipped" | "failed";

interface Result {
  candidate: Candidate;
  outcome: Outcome;
  detail?: string;
}

async function loadCandidates(limit?: number): Promise<Candidate[]> {
  const query = db
    .select({
      id: Bill.id,
      billNumber: Bill.billNumber,
      title: Bill.title,
      congress: Bill.congress,
      url: Bill.url,
      fullText: Bill.fullText,
    })
    .from(Bill)
    .where(or(isNull(Bill.description), eq(Bill.description, "")));
  const rows = limit ? await query.limit(limit) : await query;
  return rows;
}

async function resolve(candidate: Candidate): Promise<{
  description?: string;
  summary?: string;
  fullText?: string;
  outcome: Outcome;
  detail?: string;
}> {
  const parsed = candidate.congress ? parseBillUrl(candidate.url) : undefined;
  if (!parsed || !candidate.congress) {
    return {
      outcome: "skipped",
      detail: "could not parse congress/type/number from url",
    };
  }

  const summary = await fetchSummary(
    candidate.congress,
    parsed.billType,
    parsed.billNumber,
  );
  if (summary) {
    return { description: summary, summary, outcome: "congress-summary" };
  }

  let fullText = candidate.fullText ?? undefined;
  const fetchedFullText = !fullText
    ? await fetchFullText(
        candidate.congress,
        parsed.billType,
        parsed.billNumber,
      )
    : undefined;
  fullText ??= fetchedFullText;

  if (!fullText) {
    return {
      outcome: "skipped",
      detail: "no congress.gov summary or bill text published yet",
    };
  }

  const description = await generateAISummary(candidate.title, fullText);
  return {
    description,
    fullText: fetchedFullText,
    outcome: "ai-summary",
  };
}

const argv = await yargs(hideBin(process.argv))
  .option("limit", {
    alias: "l",
    type: "number",
    description: "Maximum bills to process",
  })
  .option("concurrency", {
    alias: "c",
    type: "number",
    default: 3,
    description: "Concurrent jobs (1-5)",
  })
  .option("apply", {
    type: "boolean",
    default: false,
    description:
      "Write descriptions; without this flag the command is read-only",
  })
  .option("yes", {
    type: "boolean",
    default: false,
    description: "Acknowledge production writes",
  })
  .check((args) => {
    if (
      args.limit !== undefined &&
      (!Number.isInteger(args.limit) || args.limit <= 0)
    ) {
      throw new Error("--limit must be a positive integer");
    }
    if (
      !Number.isInteger(args.concurrency) ||
      args.concurrency < 1 ||
      args.concurrency > 5
    ) {
      throw new Error("--concurrency must be an integer from 1 to 5");
    }
    return true;
  })
  .strict()
  .help()
  .parse();

async function main(): Promise<void> {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("POSTGRES_URL is required");

  const target = databaseTarget(databaseUrl);
  if (argv.apply && target.target === "production" && !argv.yes) {
    throw new Error("Production writes require both --apply and --yes");
  }
  if (argv.apply && !process.env.CONGRESS_API_KEY) {
    throw new Error("CONGRESS_API_KEY is required when --apply is set");
  }
  if (
    argv.apply &&
    !process.env.OPENROUTER_API_KEY &&
    !process.env.LOCAL_LLM_BASE_URL &&
    !process.env.DEEPSEEK_API_KEY
  ) {
    throw new Error(
      "OPENROUTER_API_KEY, LOCAL_LLM_BASE_URL, or deprecated DEEPSEEK_API_KEY is required when --apply is set",
    );
  }

  logger[target.target === "production" ? "warn" : "info"](
    databaseTargetMessage(databaseUrl),
  );

  const candidates = await loadCandidates(argv.limit);
  printHeader("Inventory");
  printKeyValue("Bills missing description", candidates.length);
  printKeyValue("Writes", argv.apply ? "enabled" : "disabled (dry run)");
  printFooter();

  if (!argv.apply || candidates.length === 0) return;

  resetCosts();
  const limit = pLimit(argv.concurrency);
  const results = await Promise.all(
    candidates.map((candidate) =>
      limit(async (): Promise<Result> => {
        logger.start(
          `${candidate.billNumber} ${candidate.title.substring(0, 70)}`,
        );
        try {
          const resolved = await resolve(candidate);
          if (resolved.description) {
            await db
              .update(Bill)
              .set({
                description: resolved.description,
                ...(resolved.summary && { summary: resolved.summary }),
                ...(resolved.fullText && { fullText: resolved.fullText }),
                updatedAt: new Date(),
              })
              .where(eq(Bill.id, candidate.id));
          }
          if (resolved.outcome === "skipped") {
            logger.info(`${candidate.billNumber} skipped: ${resolved.detail}`);
          } else {
            logger.success(
              `${candidate.billNumber} resolved via ${resolved.outcome}`,
            );
          }
          return {
            candidate,
            outcome: resolved.outcome,
            detail: resolved.detail,
          };
        } catch (error) {
          if (error instanceof AIRateLimitError) throw error;
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(`${candidate.billNumber} failed: ${message}`);
          return { candidate, outcome: "failed", detail: message };
        }
      }),
    ),
  );

  const costs = getCostSummary();
  printHeader("Result");
  printKeyValue(
    "From congress.gov summary",
    results.filter((r) => r.outcome === "congress-summary").length,
  );
  printKeyValue(
    "From AI summary",
    results.filter((r) => r.outcome === "ai-summary").length,
  );
  printKeyValue(
    "Skipped (no source yet)",
    results.filter((r) => r.outcome === "skipped").length,
  );
  printKeyValue("Failed", results.filter((r) => r.outcome === "failed").length);
  printKeyValue("Estimated API cost", `$${costs.totalCost.toFixed(4)}`);
  printFooter();

  if (results.some((r) => r.outcome === "failed")) process.exitCode = 1;
}

await main();
