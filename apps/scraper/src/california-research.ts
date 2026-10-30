import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import {
  californiaResearch,
  parseCaliforniaPreparationPolicy,
} from "./candidate-research/california.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    snapshot: { type: "string" },
    policy: { type: "string" },
    race: { type: "string", multiple: true },
    "san-jose-manifest": { type: "string" },
    "state-scope-only": { type: "boolean", default: false },
    "prepare-policy": { type: "string" },
    "max-races": { type: "string", default: "12" },
    "max-candidates": { type: "string", default: "24" },
    "max-source-requests": { type: "string", default: "100" },
    "max-source-bytes": { type: "string", default: "100000000" },
    "max-model-calls": { type: "string", default: "48" },
    "max-input-tokens": { type: "string", default: "500000" },
    concurrency: { type: "string", default: "1" },
    "include-pilot-races": { type: "boolean", default: false },
  },
});

function bound(name: keyof typeof values, maximum: number) {
  const value = Number(values[name]);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  return value;
}

async function main() {
  if (values.help) {
    console.log(
      "Usage: california-research <plan|reconcile|coverage> [--snapshot ID|latest] [--policy VERSION] [--apply]\nReconcile accepts --max-races, --max-candidates, --max-source-requests, --max-source-bytes, --max-model-calls and --max-input-tokens. Concurrency is 1. Planning without --apply performs no database writes.",
    );
    return;
  }
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !["plan", "reconcile", "coverage"].includes(command ?? "")
  )
    throw new Error(
      "Usage: california-research <plan|reconcile|coverage> [--snapshot ID] [--policy VERSION] [--apply]. Reconcile requires --apply and explicit bounds.",
    );
  if (command === "plan") {
    const sanJoseManifest: unknown = values["san-jose-manifest"]
      ? JSON.parse(await readFile(values["san-jose-manifest"], "utf8"))
      : undefined;
    const result = await californiaResearch.plan({
      electionDate: "2026-11-03",
      apply: values.apply,
      sanJoseManifest,
      stateScopeOnly: values["state-scope-only"],
      maxSourceBytes: bound("max-source-bytes", 500_000_000),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!values.snapshot)
    throw new Error("An immutable --snapshot ID is required");
  let snapshotId = values.snapshot;
  if (snapshotId === "latest") {
    const [{ getLatestCaliforniaRoster }, { db }] = await Promise.all([
      import("@acme/api/lib/california-roster-store"),
      import("@acme/db/client"),
    ]);
    snapshotId = (await getLatestCaliforniaRoster(db, "2026-11-03"))?.id ?? "";
  }
  if (!snapshotId)
    throw new Error("No authoritative California roster has been persisted");
  if (command === "coverage") {
    console.log(
      JSON.stringify(
        await californiaResearch.coverage({ snapshotId }),
        null,
        2,
      ),
    );
    return;
  }
  if (!values.apply || !values.policy)
    throw new Error(
      "Reconcile writes research and may invoke models; --apply and --policy are required",
    );
  const preparationPolicy = values["prepare-policy"]
    ? parseCaliforniaPreparationPolicy(
        JSON.parse(await readFile(values["prepare-policy"], "utf8")),
      )
    : undefined;
  const result = await californiaResearch.reconcile({
    snapshotId,
    policyVersion: values.policy,
    includePilotRaces: values["include-pilot-races"],
    raceKeys: values.race,
    preparationPolicy,
    bounds: {
      maxRaces: bound("max-races", 1000),
      maxCandidates: bound("max-candidates", 1000),
      maxSourceRequests: bound("max-source-requests", 10000),
      maxSourceBytes: bound("max-source-bytes", 500000000),
      maxModelCalls: bound("max-model-calls", 2000),
      maxInputTokens: bound("max-input-tokens", 20000000),
      concurrency: bound("concurrency", 1),
    },
  });
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "California research failed",
  );
  process.exitCode = 1;
});
