import { readFile, rename, writeFile } from "node:fs/promises";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  publishedTrillionGraph,
  TRILLION_ADDRESS_HASH,
  TRILLION_ENDPOINT,
  trillionCacheParams,
} from "@acme/api/lib/trillion";
import {
  trillionGraphSchema,
  unverifiedTrillionQuotes,
} from "@acme/validators";

import {
  collectTrillionCorpus,
  trillionCorpusSchema,
} from "./scrapers/trillion-capture.js";
import {
  assessTrillionGraph,
  generateTrillionGraph,
  summarizeTrillionGraph,
  trillionAuthoredSchema,
  trillionSummarySchema,
} from "./scrapers/trillion-generation.js";
import { trillionPrecedents } from "./scrapers/trillion-precedents.js";
import { generateStagedTrillionGraph } from "./scrapers/trillion-staged.js";
import { getStructuredLlmCandidates } from "./utils/ai/provider.js";
import { trackLLMUsage } from "./utils/costs.js";

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8"));
const save = async (path: string, value: unknown) => {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${path}.tmp`, path);
};

await yargs(hideBin(process.argv))
  .strict()
  .demandCommand(1)
  .command(
    "collect <election> <number> <output>",
    "Capture one measure's law, analysis and arguments, related measures' law, and its curated precedent; no model or DB",
    (y) =>
      y
        .positional("election", { type: "string", demandOption: true })
        .positional("number", { type: "string", demandOption: true })
        .positional("output", { type: "string", demandOption: true })
        .option("related", { type: "string", default: "" }),
    async (args) => {
      const related = args.related.split(",").filter(Boolean);
      const precedents = trillionPrecedents(args.election, args.number);
      const corpus = await collectTrillionCorpus(
        args.election,
        args.number,
        related,
        precedents,
      );
      await writeFile(args.output, JSON.stringify(corpus, null, 2) + "\n", {
        flag: "wx",
      });
      console.log(
        `Captured ${corpus.sources.length} sources for Proposition ${corpus.number}, including ${precedents.length} curated precedent documents.`,
      );
    },
  )
  .command(
    "generate <corpus> <output>",
    "Draft a graph and its summary: two paid model calls, or about a dozen with --pipeline staged; quotes that fail verification are dropped. No DB",
    (y) =>
      y
        .positional("corpus", { type: "string", demandOption: true })
        .positional("output", { type: "string", demandOption: true })
        .option("max-model-calls", { type: "number", demandOption: true })
        .option("max-prompt-chars", { type: "number", default: 400000 })
        .option("base-url", {
          type: "string",
          describe:
            "Use this OpenAI-compatible endpoint instead of the configured scraper providers",
        })
        .option("model", {
          type: "string",
          describe: "Model id at --base-url",
        })
        .option("pipeline", {
          choices: ["single", "staged"] as const,
          default: "single" as const,
          describe:
            "single: one call drafts the whole graph. staged: plan, expand each branch and dispute, check leans",
        }),
    async (args) => {
      let previous: unknown;
      try {
        previous = await readJson(args.output);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if ((args.baseUrl === undefined) !== (args.model === undefined))
        throw new Error("--base-url and --model go together");
      const candidate = args.baseUrl
        ? {
            model: createOpenAI({
              baseURL: args.baseUrl.replace(/\/$/, ""),
              apiKey: process.env.TRILLION_MODEL_API_KEY?.trim() || "unused",
            })(args.model!),
            modelVersion: `openai-compatible:${args.model}`,
          }
        : getStructuredLlmCandidates()[0]!;
      if (args.pipeline === "staged") {
        let inputTokens = 0;
        let outputTokens = 0;
        const started = Date.now();
        const result = await generateStagedTrillionGraph(
          await readJson(args.corpus),
          {
            model: candidate.modelVersion,
            maxModelCalls: args.maxModelCalls,
            maxPromptChars: args.maxPromptChars,
            previous,
            onStage: (stage, value) =>
              save(`${args.output}.${stage}.json`, value),
            call: async (prompt, schema, maxOutputTokens) => {
              const response = await generateText({
                model: candidate.model,
                output: Output.object({ schema }),
                prompt,
                maxOutputTokens,
                // Overloaded or failed calls return nothing, so a retry spends no output.
                maxRetries: 2,
                abortSignal: AbortSignal.timeout(300000),
              });
              inputTokens += response.usage.inputTokens ?? 0;
              outputTokens += response.usage.outputTokens ?? 0;
              trackLLMUsage(
                response.usage.inputTokens,
                response.usage.outputTokens,
              );
              return response.output;
            },
          },
        );
        await save(args.output, result.graph);
        console.log(
          result.reused
            ? "Input unchanged; reused the existing graph without a model call."
            : [
                `Drafted ${result.graph.nodes.length} nodes and ${result.graph.edges.length} links in ${result.calls} model calls (${inputTokens} input and ${outputTokens} output tokens, ${Math.round((Date.now() - started) / 1000)}s).`,
                `Leans corrected: ${result.corrected.length ? `\n  ${result.corrected.join("\n  ")}` : "none"}`,
                `Dropped: ${result.dropped.length ? result.dropped.join(", ") : "none"}`,
              ].join("\n"),
        );
        return;
      }
      const result = await generateTrillionGraph(await readJson(args.corpus), {
        model: candidate.modelVersion,
        maxModelCalls: args.maxModelCalls,
        maxPromptChars: args.maxPromptChars,
        previous,
        onAuthored: (value) => save(`${args.output}.raw.json`, value),
        assess: async (prompt) => {
          const response = await generateText({
            model: candidate.model,
            output: Output.object({ schema: trillionAuthoredSchema }),
            prompt,
            maxOutputTokens: 32000,
            // Overloaded or failed calls return nothing, so a retry spends no output.
            maxRetries: 2,
            abortSignal: AbortSignal.timeout(300000),
          });
          trackLLMUsage(
            response.usage.inputTokens,
            response.usage.outputTokens,
          );
          return response.output;
        },
        assessSummary: async (prompt) => {
          const response = await generateText({
            model: candidate.model,
            output: Output.object({ schema: trillionSummarySchema }),
            prompt,
            maxOutputTokens: 4000,
            // Overloaded or failed calls return nothing, so a retry spends no output.
            maxRetries: 2,
            abortSignal: AbortSignal.timeout(300000),
          });
          trackLLMUsage(
            response.usage.inputTokens,
            response.usage.outputTokens,
          );
          return response.output;
        },
      });
      await save(args.output, result.graph);
      console.log(
        result.reused
          ? "Input unchanged; reused the existing graph without a model call."
          : `Drafted ${result.graph.nodes.length} nodes and ${result.graph.edges.length} links; dropped ${result.dropped.length} unverifiable items${result.dropped.length ? `: ${result.dropped.join(", ")}` : ""}.`,
      );
    },
  )
  .command(
    "check <graph> <corpus>",
    "Run the publication gate against the capture; no network, model or DB",
    (y) =>
      y
        .positional("graph", { type: "string", demandOption: true })
        .positional("corpus", { type: "string", demandOption: true }),
    async (args) => {
      const graph = trillionGraphSchema.parse(await readJson(args.graph));
      const corpus = trillionCorpusSchema.parse(await readJson(args.corpus));
      const unverified = unverifiedTrillionQuotes(graph);
      const published = publishedTrillionGraph(
        corpus.guide,
        graph.measure.number,
        graph,
        corpus.sources.map((s) => ({ url: s.url, hash: s.documentHash })),
      );
      console.log(
        `${graph.nodes.length} nodes, ${graph.edges.length} links; unverified quotes: ${unverified.length ? unverified.join(", ") : "none"}; publication gate: ${published ? "passes" : "fails"}.`,
      );
      if (!published) process.exitCode = 1;
    },
  )
  .command(
    "summarize <graph> <corpus>",
    "Redraft only the summary of a graph, from the measure's legal text alone; one paid model call. No DB",
    (y) =>
      y
        .positional("graph", { type: "string", demandOption: true })
        .positional("corpus", { type: "string", demandOption: true })
        .option("max-model-calls", { type: "number", demandOption: true })
        .option("base-url", { type: "string" })
        .option("model", { type: "string" }),
    async (args) => {
      if ((args.baseUrl === undefined) !== (args.model === undefined))
        throw new Error("--base-url and --model go together");
      const candidate = args.baseUrl
        ? {
            model: createOpenAI({
              baseURL: args.baseUrl.replace(/\/$/, ""),
              apiKey: process.env.TRILLION_MODEL_API_KEY?.trim() || "unused",
            })(args.model!),
            modelVersion: `openai-compatible:${args.model}`,
          }
        : getStructuredLlmCandidates()[0]!;
      const { graph, dropped } = await summarizeTrillionGraph(
        await readJson(args.corpus),
        await readJson(args.graph),
        {
          model: candidate.modelVersion,
          maxModelCalls: args.maxModelCalls,
          assessSummary: async (prompt) => {
            const response = await generateText({
              model: candidate.model,
              output: Output.object({ schema: trillionSummarySchema }),
              prompt,
              maxOutputTokens: 4000,
              // Overloaded or failed calls return nothing, so a retry spends no output.
              maxRetries: 2,
              abortSignal: AbortSignal.timeout(300000),
            });
            trackLLMUsage(
              response.usage.inputTokens,
              response.usage.outputTokens,
            );
            return response.output;
          },
        },
      );
      await save(args.graph, graph);
      console.log(
        `Summary: ${graph.summary?.text}\nDropped: ${dropped.join(", ") || "none"}`,
      );
    },
  )
  .command(
    "eval <graph>",
    "Print quality signals used to tune generation; no network, model or DB",
    (y) => y.positional("graph", { type: "string", demandOption: true }),
    async (args) => {
      const graph = trillionGraphSchema.parse(await readJson(args.graph));
      console.log(JSON.stringify(assessTrillionGraph(graph), null, 2));
    },
  )
  .command(
    "store <graph>",
    "Write a checked graph to civic_api_cache for the API. Writes to the selected database",
    (y) => y.positional("graph", { type: "string", demandOption: true }),
    async (args) => {
      const graph = trillionGraphSchema.parse(await readJson(args.graph));
      if (unverifiedTrillionQuotes(graph).length)
        throw new Error("Graph has unverified quotes; run check first");
      const { db } = await import("@acme/db/client");
      const { CivicApiCache } = await import("@acme/db/schema");
      const params = JSON.stringify(
        trillionCacheParams(graph.electionDate, graph.measure.number),
      );
      const fetchedAt = new Date();
      // Freshness is enforced on every read by source hashes, not by expiry.
      const expiresAt = new Date(fetchedAt.getTime() + 400 * 24 * 3600 * 1000);
      await db
        .insert(CivicApiCache)
        .values({
          addressHash: TRILLION_ADDRESS_HASH,
          endpoint: TRILLION_ENDPOINT,
          params,
          responseData: graph,
          fetchedAt,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            CivicApiCache.addressHash,
            CivicApiCache.endpoint,
            CivicApiCache.params,
          ],
          set: { responseData: graph, fetchedAt, expiresAt },
        });
      console.log(
        `Stored Proposition ${graph.measure.number} revision ${graph.revision}. It appears once the guide job has hashed its sources.`,
      );
      process.exit(0);
    },
  )
  .help()
  .parseAsync();
