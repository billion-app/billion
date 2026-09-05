import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import type { JobDefinition } from "./types.js";

const manifestSchema = z
  .object({
    state: z.enum(["ca", "nc", "tx"]),
    session: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[\w -]+$/),
    bills: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[A-Z]+\s+\d+[A-Z]?$/),
      )
      .min(1)
      .max(200),
  })
  .strict();

export function targetedJob(
  job: JobDefinition,
  manifest: unknown,
): JobDefinition {
  const { state, session, bills } = manifestSchema.parse(manifest);
  return {
    ...job,
    script: "main.js",
    args: [
      "open-states",
      "--session",
      session,
      ...[...new Set(bills)].flatMap((bill) => ["--bill", bill]),
    ],
    env: { ...job.env, OPEN_STATES_STATES: state },
  };
}

export async function resolveTargetedJob(
  job: JobDefinition,
): Promise<JobDefinition> {
  if (job.id !== "open-states-targeted") return job;
  const directory = process.env.SUPERVISOR_STATE_DIR ?? "/var/lib/billion";
  const manifest: unknown = JSON.parse(
    await readFile(join(directory, "open-states-targeted.json"), "utf8"),
  );
  return targetedJob(job, manifest);
}
