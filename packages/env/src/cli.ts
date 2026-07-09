#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  password,
  select,
  text,
} from "@clack/prompts";
import yargs from "yargs";

import type {
  EnvDefinition,
  EnvSurface,
  Requirement,
  ScraperName,
} from "./index";
import { readEnvFile, repoRoot, writeEnvValues } from "./files";
import {
  definitionsFor,
  definitionsForAll,
  scraperNames,
  surfaces,
  validateEnvironment,
} from "./index";

interface CliOptions {
  command: "doctor" | "setup" | "template";
  target?: EnvSurface | "all";
  scrapers?: ScraperName[];
  file: string;
  source: "file" | "process";
  output?: string;
  includeOptional: boolean;
  overwrite: boolean;
}

function stopIfCancelled<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Environment setup cancelled. No additional values were written.");
    process.exit(0);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const parsed = yargs(argv.filter((argument) => argument !== "--"))
    .scriptName("pnpm env")
    .usage("$0 <doctor|setup|template> [options]")
    .command("doctor", "Validate an environment without printing values")
    .command("setup", "Interactively configure a target-specific value file")
    .command("template", "Generate a secret-free target template")
    .demandCommand(1)
    .option("target", {
      type: "string",
      choices: [...surfaces, "all"] as const,
      describe: "Application surface",
    })
    .option("scraper", {
      alias: "scrapers",
      type: "array",
      string: true,
      coerce(values: string[] | undefined) {
        return values?.flatMap((value) => value.split(","));
      },
      choices: scraperNames,
      describe: "Scraper name(s), comma-separated or repeated",
    })
    .option("file", {
      type: "string",
      default: resolve(repoRoot, ".env"),
      describe: "Environment value file",
    })
    .option("source", {
      type: "string",
      choices: ["file", "process"] as const,
      default: "file",
      describe: "Validate a dotenv file or the current process environment",
    })
    .option("output", {
      type: "string",
      describe: "Template output path; stdout when omitted",
    })
    .option("include-optional", {
      type: "boolean",
      default: false,
      describe: "Include optional values during setup",
    })
    .option("overwrite", {
      type: "boolean",
      default: false,
      describe: "Prompt for values that are already configured",
    })
    .strict()
    .help()
    .parseSync();
  return {
    command: String(parsed._[0]) as CliOptions["command"],
    target: parsed.target,
    scrapers: parsed.scraper as ScraperName[] | undefined,
    file: resolve(repoRoot, parsed.file),
    source: parsed.source as CliOptions["source"],
    output: parsed.output ? resolve(repoRoot, parsed.output) : undefined,
    includeOptional: parsed.includeOptional,
    overwrite: parsed.overwrite,
  };
}

async function chooseTarget(current?: EnvSurface | "all") {
  if (current && current !== "all") return current;
  return stopIfCancelled(
    await select<EnvSurface>({
      message: "Which app surface are you configuring?",
      options: [
        { value: "nextjs", label: "Next.js website and API" },
        { value: "expo", label: "Expo mobile build" },
        { value: "scraper", label: "Scraper jobs" },
        { value: "database", label: "Database tooling" },
        { value: "social", label: "Social-media agent" },
      ],
    }),
  );
}

async function chooseScrapers(current?: ScraperName[]) {
  if (current?.length) return current;
  return stopIfCancelled(
    await multiselect<ScraperName>({
      message: "Which scrapers will this environment run?",
      options: scraperNames.map((name) => ({ value: name, label: name })),
      initialValues: [...scraperNames],
      required: true,
    }),
  );
}

function displayStatus(
  state: "configured" | "missing" | "invalid",
  key: string,
  requirement: Requirement,
  message?: string,
) {
  const suffix = `${key.padEnd(33)} ${requirement}`;
  if (state === "configured") log.success(suffix);
  else if (state === "invalid")
    log.error(`${suffix} — ${message ?? "invalid"}`);
  else if (requirement === "required") log.error(`${suffix} — missing`);
  else if (requirement === "recommended") log.warn(`${suffix} — missing`);
  else log.info(`${suffix} — not configured`);
}

function extraConsistencyIssues(
  environment: Record<string, string | undefined>,
) {
  const issues: string[] = [];
  if (
    Boolean(environment.AUTH_DISCORD_ID) !==
    Boolean(environment.AUTH_DISCORD_SECRET)
  ) {
    issues.push(
      "AUTH_DISCORD_ID and AUTH_DISCORD_SECRET must be configured together.",
    );
  }
  if (
    Boolean(environment.GOOGLE_API_KEY) !==
    Boolean(environment.GOOGLE_SEARCH_ENGINE_ID)
  ) {
    issues.push(
      "GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID must both be set for scraper image search.",
    );
  }
  return issues;
}

function runDoctor(options: CliOptions) {
  const environment =
    options.source === "process"
      ? (process.env as Record<string, string | undefined>)
      : readEnvFile(options.file);
  const targets =
    options.target === "all" || !options.target ? surfaces : [options.target];
  let failed = false;
  intro(
    `env doctor · ${options.source === "process" ? "process environment" : options.file}`,
  );
  for (const surface of targets) {
    const result = validateEnvironment({
      environment,
      surface,
      scrapers: surface === "scraper" ? options.scrapers : undefined,
    });
    log.step(surface);
    for (const status of result.statuses) {
      const issue = result.issues.find(
        (item) => item.key === status.definition.key,
      );
      displayStatus(
        status.state,
        status.definition.key,
        status.requirement,
        issue?.message,
      );
    }
    if (!result.success) failed = true;
  }
  for (const issue of extraConsistencyIssues(environment)) {
    log.error(issue);
    failed = true;
  }
  if (failed) {
    outro("Environment needs attention. Values were never printed.");
    process.exitCode = 1;
  } else {
    outro("Environment contract satisfied.");
  }
}

async function promptForValue(
  definition: EnvDefinition,
  requirement: Requirement,
) {
  note(
    [
      definition.description,
      `Requirement: ${requirement}`,
      definition.setupUrl ? `Get it: ${definition.setupUrl}` : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
    definition.key,
  );
  if (definition.key === "BETTER_AUTH_SECRET") {
    const generate = stopIfCancelled(
      await confirm({
        message: "Generate a secure local auth secret automatically?",
        initialValue: true,
      }),
    );
    if (generate) return randomBytes(32).toString("base64url");
  }
  const promptOptions = {
    message: `Enter ${definition.key} (leave empty to skip)`,
    validate(value: string | undefined) {
      if (!value) return undefined;
      const result = definition.schema.safeParse(value);
      return result.success
        ? undefined
        : (result.error.issues[0]?.message ?? "Invalid value");
    },
  };
  return stopIfCancelled(
    definition.secret
      ? await password({ ...promptOptions, mask: "•" })
      : await text({
          ...promptOptions,
          defaultValue: definition.defaultValue,
          placeholder: definition.example ?? definition.defaultValue,
        }),
  );
}

async function runSetup(options: CliOptions) {
  const surface = await chooseTarget(options.target);
  const selectedScrapers =
    surface === "scraper" ? await chooseScrapers(options.scrapers) : undefined;
  const existing = readEnvFile(options.file);
  const pending = definitionsFor(surface, selectedScrapers);

  intro(`env setup · ${surface}`);
  note(
    `Destination: ${options.file}\nOnly ${surface} variables will be requested. Secret values are masked and never logged.`,
    "Safety boundary",
  );

  let includeOptional = options.includeOptional;
  if (
    !includeOptional &&
    pending.some((item) => item.requirement === "optional")
  ) {
    includeOptional = stopIfCancelled(
      await confirm({
        message: "Configure optional variables too?",
        initialValue: false,
      }),
    );
  }

  const updates: Record<string, string> = {};
  for (const { definition, requirement } of pending) {
    if (requirement === "optional" && !includeOptional) continue;
    const current = existing[definition.key];
    if (
      current &&
      !options.overwrite &&
      definition.schema.safeParse(current).success
    ) {
      log.success(`${definition.key} already configured`);
      continue;
    }
    const configure = stopIfCancelled(
      await confirm({
        message: `Configure ${definition.key}? (${requirement})`,
        initialValue: requirement === "required",
      }),
    );
    if (!configure) continue;
    const value = await promptForValue(definition, requirement);
    if (value) updates[definition.key] = value;
  }

  if (Object.keys(updates).length === 0) {
    outro("No environment values changed.");
    return;
  }
  writeEnvValues(options.file, updates);
  outro(`Updated ${Object.keys(updates).length} value(s) in ${options.file}.`);
  runDoctor({
    ...options,
    command: "doctor",
    target: surface,
    scrapers: selectedScrapers,
  });
}

function renderTemplate(options: CliOptions) {
  if (!options.target) throw new Error("template requires --target");
  const definitions =
    options.target === "all"
      ? definitionsForAll()
      : definitionsFor(options.target, options.scrapers);
  const lines = [
    `# Generated environment template for ${options.target}.`,
    "# Source of truth: packages/env/src/registry.ts",
    "# Contains no secret values. Run pnpm env:setup to configure a value file.",
    "",
  ];
  let group = "";
  for (const { definition, requirement } of definitions) {
    if (definition.group !== group) {
      group = definition.group;
      lines.push(`# ${group}`);
    }
    lines.push(`# ${definition.description}`);
    if (definition.setupUrl) lines.push(`# Get it: ${definition.setupUrl}`);
    const value = definition.defaultValue ?? definition.example ?? "";
    const line = `${definition.key}=${value}`;
    lines.push(requirement === "required" ? line : `# ${line}`, "");
  }
  const output = `${lines.join("\n").trimEnd()}\n`;
  if (options.output) {
    writeFileSync(options.output, output, "utf8");
    log.success(`Wrote secret-free template to ${options.output}`);
  } else {
    process.stdout.write(output);
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === "doctor") runDoctor(options);
    else if (options.command === "setup") await runSetup(options);
    else renderTemplate(options);
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

await main();
