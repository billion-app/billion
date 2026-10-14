import { createOpenAI } from "@ai-sdk/openai";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod/v4";

import { getCaliforniaGuide } from "@acme/api/lib/civic";
import {
  TRILLION_ADDRESS_HASH,
  TRILLION_ENDPOINT,
  trillionCacheParams,
  trillionGateProblem,
} from "@acme/api/lib/trillion";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { TrillionCorpus } from "./scrapers/trillion-capture.js";
import { GUIDE_BASE, guideLinks } from "./scrapers/ca-official-guide-parser.js";
import { fetchGuidePage } from "./scrapers/ca-official-guide-source.js";
import { sourceHash } from "./scrapers/measure-relationship-capture.js";
import { collectTrillionCorpus } from "./scrapers/trillion-capture.js";
import {
  generateTrillionGraph,
  TRILLION_PROMPT_VERSION,
  TRILLION_SUMMARY_PROMPT_VERSION,
  trillionAuthoredSchema,
  trillionSummarySchema,
} from "./scrapers/trillion-generation.js";
import { trillionPrecedents } from "./scrapers/trillion-precedents.js";
import { getStructuredLlmCandidates } from "./utils/ai/provider.js";
import { trackLLMUsage } from "./utils/costs.js";
import { createLogger } from "./utils/log.js";

/**
 * Keep a Trillion graph for every proposition in the current California guide
 * (#455). Runs daily from the supervisor and is cheap to repeat:
 *
 * - A graph whose sources and prompt are unchanged is reused: no model call,
 *   no write. Graphs regenerate only when a source document or the prompt
 *   changes.
 * - A generation that fails is remembered by its input fingerprint and not
 *   retried for a week, so one broken measure cannot spend calls every night.
 * - Only graphs that pass the API's publication gate are stored. The guide job
 *   that runs after this one fingerprints their sources, which is what lets
 *   readers see them.
 */
const logger = createLogger("trillion-propositions");
const FAILURE_ENDPOINT = "trillion-v1-failed";
const FAILURE_RETRY_DAYS = 7;
/** Attempts per proposition before a content failure is recorded. */
const ATTEMPTS = 3;
const PROVIDER_ERROR =
  /invalid_request_error|No completed response|APICallError|Failed after \d+ attempts|overloaded|rate.?limit|\b(?:429|5\d\d)\b|ECONN|ETIMEDOUT|fetch failed|aborted|timed? ?out/i;

const argv = await yargs(hideBin(process.argv))
  .option("election", {
    type: "string",
    default: process.env.CA_GUIDE_ELECTION_DATE ?? "2026-11-03",
  })
  .option("max-model-calls", {
    type: "number",
    default: 24,
    describe: "Budget for the whole run; each new graph costs two calls",
  })
  .option("max-prompt-chars", { type: "number", default: 400000 })
  .option("only", {
    type: "string",
    describe: "Comma-separated proposition numbers",
  })
  .option("dry-run", {
    type: "boolean",
    default: false,
    describe: "Capture and report what would be generated; no model or writes",
  })
  .option("base-url", { type: "string" })
  .option("model", { type: "string" })
  .strict()
  .parseAsync();

if ((argv.baseUrl === undefined) !== (argv.model === undefined))
  throw new Error("--base-url and --model go together");
const candidate = argv.baseUrl
  ? {
      model: createOpenAI({
        baseURL: argv.baseUrl.replace(/\/$/, ""),
        apiKey: process.env.TRILLION_MODEL_API_KEY?.trim() || "unused",
      })(argv.model ?? ""),
      modelVersion: `openai-compatible:${argv.model}`,
    }
  : getStructuredLlmCandidates()[0];
if (!candidate) throw new Error("No scraper text provider is configured");

/** Every proposition number listed in the guide's index. */
async function guidePropositions(electionDate: string): Promise<string[]> {
  const index = await fetchGuidePage(`${GUIDE_BASE}/propositions/`);
  const numbers = guideLinks(index, "measures").flatMap((url) => {
    const match = /\/propositions\/(\d+[a-z]?)\/?$/i.exec(url);
    return match?.[1] ? [match[1].toUpperCase()] : [];
  });
  if (!numbers.length)
    throw new Error(`No propositions found in the ${electionDate} guide`);
  return [...new Set(numbers)];
}

/** Other propositions this measure's own text or analysis names. */
function mentionedMeasures(
  corpus: TrillionCorpus,
  all: readonly string[],
): string[] {
  const text = corpus.sources
    .filter((s) => s.number === corpus.number && s.role !== "precedent")
    .map((s) => s.snapshot)
    .join("\n");
  const found = new Set<string>();
  for (const match of text.matchAll(/Proposition\s+(\d{1,3}[A-Z]?)\b/g)) {
    const n = match[1]?.toUpperCase();
    if (n && n !== corpus.number && all.includes(n)) found.add(n);
  }
  return [...found].slice(0, 4);
}

const rowKey = (endpoint: string, number: string) =>
  and(
    eq(CivicApiCache.addressHash, TRILLION_ADDRESS_HASH),
    eq(CivicApiCache.endpoint, endpoint),
    eq(
      CivicApiCache.params,
      JSON.stringify(trillionCacheParams(argv.election, number)),
    ),
  );
async function readRow(endpoint: string, number: string) {
  const [row] = await db
    .select({ data: CivicApiCache.responseData, at: CivicApiCache.fetchedAt })
    .from(CivicApiCache)
    .where(rowKey(endpoint, number))
    .limit(1);
  return row;
}
async function writeRow(endpoint: string, number: string, data: unknown) {
  const fetchedAt = new Date();
  // Freshness is enforced on every read by source hashes, not by expiry.
  const expiresAt = new Date(fetchedAt.getTime() + 400 * 24 * 3600 * 1000);
  await db
    .insert(CivicApiCache)
    .values({
      addressHash: TRILLION_ADDRESS_HASH,
      endpoint,
      params: JSON.stringify(trillionCacheParams(argv.election, number)),
      responseData: data,
      fetchedAt,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        CivicApiCache.addressHash,
        CivicApiCache.endpoint,
        CivicApiCache.params,
      ],
      set: { responseData: data, fetchedAt, expiresAt },
    });
}

const call = async (
  prompt: string,
  schema: z.ZodType,
  maxOutputTokens: number,
) => {
  const response = await generateText({
    model: candidate.model,
    output: Output.object({ schema }),
    prompt,
    maxOutputTokens,
    // Overloaded or failed calls return nothing, so a retry spends no output.
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(300000),
  }).catch(async (error: unknown) => {
    if (!NoObjectGeneratedError.isInstance(error) || !error.text) throw error;
    // For diagnosis: keep an answer that failed the schema, with the reason.
    if (process.env.TRILLION_DEBUG_DIR) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        `${process.env.TRILLION_DEBUG_DIR}/rejected-${Date.now()}.txt`,
        `${String(error.cause)}\n\n${error.text}`,
      );
    }
    // One malformed card should not cost the rest: the generator keeps every
    // part that parses on its own and checks the whole again.
    try {
      return { output: JSON.parse(error.text) as unknown, usage: error.usage };
    } catch {
      throw error;
    }
  });
  trackLLMUsage(response.usage?.inputTokens, response.usage?.outputTokens);
  return response.output;
};

const numbers = await guidePropositions(argv.election);
const wanted = argv.only
  ? argv.only.split(",").map((n) => n.trim().toUpperCase())
  : numbers;
logger.info(
  `${argv.election}: ${numbers.length} propositions; working on ${wanted.join(", ")} with ${candidate.modelVersion}`,
);

// The stored guide the API checks against; absent locally, the capture stands in.
const fullGuide = await getCaliforniaGuide().catch(() => null);
if (fullGuide && fullGuide.electionDate !== argv.election)
  throw new Error(
    `Stored guide is for ${fullGuide.electionDate}, not ${argv.election}`,
  );

let calls = 0;
const tally = { reused: 0, stored: 0, failed: 0, skipped: 0 };
for (const number of wanted) {
  try {
    const precedents = trillionPrecedents(argv.election, number);
    let corpus = await collectTrillionCorpus(
      argv.election,
      number,
      [],
      precedents,
    );
    const related = mentionedMeasures(corpus, numbers);
    if (related.length)
      corpus = await collectTrillionCorpus(
        argv.election,
        number,
        related,
        precedents,
      );
    const previous = (await readRow(TRILLION_ENDPOINT, number))?.data;

    // Reuse costs nothing: the generator checks the input fingerprint before
    // any call, so a zero budget either returns the stored graph or says a
    // call is needed. Any other error is a source or budget problem.
    const check = await generateTrillionGraph(corpus, {
      model: candidate.modelVersion,
      maxModelCalls: 0,
      maxPromptChars: argv.maxPromptChars,
      previous,
      assess: () => Promise.reject(new Error("no call")),
      assessSummary: () => Promise.reject(new Error("no call")),
    }).catch((error: Error) => error);
    if (!(check instanceof Error) && check.reused) {
      tally.reused++;
      logger.info(`Prop ${number}: sources unchanged; kept the stored graph`);
      continue;
    }
    if (check instanceof Error && !/maxModelCalls is 0/.test(check.message))
      throw check;

    // A failed input is not retried for a week; a changed source, prompt or
    // model makes it a new input.
    const inputHash = sourceHash(
      JSON.stringify({
        sources: corpus.sources.map((s) => s.hash),
        prompt: TRILLION_PROMPT_VERSION,
        summary: TRILLION_SUMMARY_PROMPT_VERSION,
        model: candidate.modelVersion,
        // Bumped when what counts as a failure changes, so stale records stop matching.
        failureRules: 2,
      }),
    );
    const failure = await readRow(FAILURE_ENDPOINT, number);
    const failedHash = (failure?.data as { inputHash?: string } | undefined)
      ?.inputHash;
    const ageDays = failure
      ? (Date.now() - failure.at.getTime()) / 86400000
      : Infinity;
    if (failedHash === inputHash && ageDays < FAILURE_RETRY_DAYS) {
      tally.skipped++;
      logger.info(
        `Prop ${number}: this input failed ${ageDays.toFixed(1)} days ago; retrying after ${FAILURE_RETRY_DAYS} days`,
      );
      continue;
    }
    if (argv.dryRun) {
      tally.skipped++;
      logger.info(
        `Prop ${number}: would generate (${corpus.sources.length} sources${related.length ? `, related ${related.join(", ")}` : ""})`,
      );
      continue;
    }
    // A bad answer is often a one-off, so a failure is recorded only after
    // every attempt fails. Provider errors end the attempts and are retried next run.
    let stored = false;
    let lastError: string | undefined;
    let providerError = false;
    let attempt = 0;
    for (; attempt < ATTEMPTS && !stored; attempt++) {
      if (calls + 2 > argv.maxModelCalls) break;
      calls += 2;
      try {
        const result = await generateTrillionGraph(corpus, {
          model: candidate.modelVersion,
          maxModelCalls: 2,
          maxPromptChars: argv.maxPromptChars,
          ballot: numbers,
          // For diagnosis: keep the model's raw answer when asked to.
          onAuthored: process.env.TRILLION_DEBUG_DIR
            ? async (value) => {
                const { writeFile } = await import("node:fs/promises");
                await writeFile(
                  `${process.env.TRILLION_DEBUG_DIR}/prop${number}.raw.json`,
                  JSON.stringify(value, null, 2),
                );
              }
            : undefined,
          assess: (prompt) => call(prompt, trillionAuthoredSchema, 32000),
          assessSummary: (prompt) => call(prompt, trillionSummarySchema, 4000),
        });
        // The gate as the API runs it: the full stored guide (cards may name any
        // measure on the ballot), with this run's captures as current sources,
        // since the guide job fingerprints them only after this job.
        const problem = trillionGateProblem(
          fullGuide ?? corpus.guide,
          number,
          result.graph,
          corpus.sources.map((s) => ({ url: s.url, hash: s.documentHash })),
        );
        if (problem)
          throw new Error(
            `generated graph fails the publication gate: ${problem}`,
          );
        await writeRow(TRILLION_ENDPOINT, number, result.graph);
        tally.stored++;
        logger.info(
          `Prop ${number}: stored ${result.graph.nodes.length} cards; dropped ${result.dropped.length}${result.dropped.length ? ` (${result.dropped.slice(0, 8).join(", ")})` : ""}`,
        );
        stored = true;
      } catch (error) {
        lastError = (error as Error).message;
        logger.warn(
          `Prop ${number}: attempt ${attempt + 1} of ${ATTEMPTS} failed: ${lastError.slice(0, 300)}`,
        );
        if (PROVIDER_ERROR.test(lastError)) {
          providerError = true;
          break;
        }
      }
    }
    if (stored) continue;
    if (lastError === undefined) {
      tally.skipped++;
      logger.info(`Prop ${number}: run budget spent; next run picks it up`);
      continue;
    }
    tally.failed++;
    // Only a failure of the content is worth remembering. Request, provider
    // and network errors say nothing about this input and are retried next run;
    // so is an input whose attempts the run budget cut short.
    if (providerError || attempt < ATTEMPTS) {
      logger.warn(`Prop ${number}: not recorded as failed; retried next run`);
      continue;
    }
    await writeRow(FAILURE_ENDPOINT, number, {
      inputHash,
      error: lastError.slice(0, 2000),
    });
    logger.warn(
      `Prop ${number}: all ${ATTEMPTS} attempts failed; not retried for ${FAILURE_RETRY_DAYS} days unless a source changes`,
    );
  } catch (error) {
    tally.failed++;
    logger.warn(
      `Prop ${number}: capture failed: ${(error as Error).message.slice(0, 300)}`,
    );
  }
}
logger.info(
  `Done: ${tally.stored} stored, ${tally.reused} unchanged, ${tally.skipped} skipped, ${tally.failed} failed; ${calls} model calls.`,
);
process.exit(0);
