import { readFile, rename, writeFile } from "node:fs/promises";
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
  generateTrillionGraph,
  trillionAuthoredSchema,
} from "./scrapers/trillion-generation.js";
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
    "Capture one measure's law, analysis and arguments (plus related measures' law); no model or DB",
    (y) =>
      y
        .positional("election", { type: "string", demandOption: true })
        .positional("number", { type: "string", demandOption: true })
        .positional("output", { type: "string", demandOption: true })
        .option("related", { type: "string", default: "" }),
    async (args) => {
      const related = args.related.split(",").filter(Boolean);
      const corpus = await collectTrillionCorpus(
        args.election,
        args.number,
        related,
      );
      await writeFile(args.output, JSON.stringify(corpus, null, 2) + "\n", {
        flag: "wx",
      });
      console.log(
        `Captured ${corpus.sources.length} sources for Proposition ${corpus.number}.`,
      );
    },
  )
  .command(
    "generate <corpus> <output>",
    "Draft a graph with one paid model call; quotes that fail verification are dropped. No DB",
    (y) =>
      y
        .positional("corpus", { type: "string", demandOption: true })
        .positional("output", { type: "string", demandOption: true })
        .option("max-model-calls", { type: "number", demandOption: true })
        .option("max-prompt-chars", { type: "number", default: 400000 }),
    async (args) => {
      let previous: unknown;
      try {
        previous = await readJson(args.output);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const candidate = getStructuredLlmCandidates()[0]!;
      const result = await generateTrillionGraph(await readJson(args.corpus), {
        model: candidate.modelVersion,
        maxModelCalls: args.maxModelCalls,
        maxPromptChars: args.maxPromptChars,
        previous,
        assess: async (prompt) => {
          const response = await generateText({
            model: candidate.model,
            output: Output.object({ schema: trillionAuthoredSchema }),
            prompt,
            maxOutputTokens: 32000,
            maxRetries: 0,
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
