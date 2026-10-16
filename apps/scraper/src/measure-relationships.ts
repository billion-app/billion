import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generateText, Output } from "ai";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { relationshipEvidenceHash } from "@acme/api/lib/measure-relationships";
import { measureRelationshipSchema } from "@acme/validators";

import { collectRelationshipCorpus } from "./scrapers/measure-relationship-capture.js";
import {
  discoverMeasureRelationships,
  relationshipAssessmentRecordSchema,
  relationshipAssessmentSchema,
  validateRelationshipCorpus,
} from "./scrapers/measure-relationship-generation.js";
import { registerRelationshipRevisions } from "./scrapers/measure-relationship-register.js";
import { getStructuredLlmCandidates } from "./utils/ai/provider.js";
import { trackLLMUsage } from "./utils/costs.js";

const readJson = async (path: string) =>
  JSON.parse(await readFile(path, "utf8"));
await yargs(hideBin(process.argv))
  .strict()
  .demandCommand(1)
  .command(
    "collect <election> <output>",
    "Capture all election measures and official evidence; no model or DB",
    (y) =>
      y
        .positional("election", { type: "string", demandOption: true })
        .positional("output", { type: "string", demandOption: true })
        .option("max-measures", { type: "number", demandOption: true }),
    async (args) => {
      const corpus = await collectRelationshipCorpus(
        args.election,
        args.maxMeasures,
      );
      await writeFile(args.output, JSON.stringify(corpus, null, 2) + "\n", {
        flag: "wx",
      });
      console.log(
        `Captured ${corpus.guide.measures.length} measures and ${corpus.sources.length} sources; no relationships assumed.`,
      );
    },
  )
  .command(
    "generate <corpus> <output>",
    "Evaluate all pairs and draft only material relationships; paid model calls, no DB",
    (y) =>
      y
        .positional("corpus", { type: "string", demandOption: true })
        .positional("output", { type: "string", demandOption: true })
        .option("max-pairs", { type: "number", demandOption: true })
        .option("max-model-calls", { type: "number", demandOption: true })
        .option("max-prompt-chars", { type: "number", default: 200000 }),
    async (args) => {
      const corpus = await readJson(args.corpus);
      const candidate =
        validateRelationshipCorpus(corpus).guide.measures.length < 2
          ? null
          : getStructuredLlmCandidates()[0]!;
      let previous = [];
      try {
        previous = (await readJson(args.output)).assessments.map((r: unknown) =>
          relationshipAssessmentRecordSchema.parse(r),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const save = async (value: unknown) => {
        await writeFile(
          `${args.output}.tmp`,
          JSON.stringify(value, null, 2) + "\n",
        );
        await rename(`${args.output}.tmp`, args.output);
      };
      const result = await discoverMeasureRelationships(corpus, {
        model: candidate?.modelVersion ?? "no-model-required",
        maxPairs: args.maxPairs,
        maxModelCalls: args.maxModelCalls,
        maxPromptChars: args.maxPromptChars,
        previous,
        assess: async (prompt) => {
          if (!candidate) throw new Error("Unexpected pair without a model");
          const result = await generateText({
            model: candidate.model,
            output: Output.object({ schema: relationshipAssessmentSchema }),
            prompt,
            maxOutputTokens: 8000,
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(120000),
          });
          trackLLMUsage(result.usage.inputTokens, result.usage.outputTokens);
          return result.output;
        },
        onAssessment: (assessments) => save({ complete: false, assessments }),
      });
      await save(result);
      console.log(
        `Assessed ${result.assessments.length} pairs; ${result.assessments.filter((r) => r.draft).length} pending relationship drafts. No automatic approval.`,
      );
    },
  )
  .command(
    "review-hash <draft>",
    "Print the evidence hash for an independently reviewed draft; does not approve",
    (y) => y.positional("draft", { type: "string", demandOption: true }),
    async (args) => {
      const value = await readJson(args.draft);
      console.log(
        relationshipEvidenceHash(
          measureRelationshipSchema.parse(value.draft ?? value),
        ),
      );
    },
  )
  .command(
    "register <corpus> <reviewed>",
    "Register approved revisions and regenerate the server registry; no DB",
    (y) =>
      y
        .positional("corpus", { type: "string", demandOption: true })
        .positional("reviewed", { type: "string", demandOption: true })
        .option("registry-dir", {
          type: "string",
          default: fileURLToPath(
            new URL(
              "../../../packages/api/src/lib/measure-relationship-revisions/",
              import.meta.url,
            ),
          ),
        }),
    async (args) => {
      const value = await readJson(args.reviewed);
      if (!Array.isArray(value))
        throw new Error(
          "Reviewed input must be an array of approved relationship revisions",
        );
      const count = await registerRelationshipRevisions(
        await readJson(args.corpus),
        value,
        args.registryDir,
      );
      console.log(
        `Registered ${count} approved revisions; commit the records and generated registry for review.`,
      );
    },
  )
  .help()
  .parseAsync();
