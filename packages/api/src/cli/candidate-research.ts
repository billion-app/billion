/** Trusted editorial operations. Reading a candidate never calls this program. */
import { readFile } from "node:fs/promises";
import { z } from "zod/v4";

import { loadRepoEnv } from "@acme/env/load";
import {
  candidateBriefSchema,
  candidateRaceManifestSchema,
} from "@acme/validators";

import {
  recordCandidateBriefReview,
  storeCandidateBriefDraft,
} from "../lib/candidate-brief-revisions";
import {
  releaseCandidateRace,
  revokeCandidateRace,
} from "../lib/candidate-race-store";

loadRepoEnv();
const [command, path, writeFlag] = process.argv.slice(2);
const reviewSchema = z.object({
  revisionId: z.uuid(),
  actorId: z.string().trim().min(1),
  action: z.enum(["approve", "withdraw"]),
  policyVersion: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});
const revokeSchema = z.object({
  releaseId: z.uuid(),
  reason: z.string().trim().min(1),
});
async function main() {
  if (
    !path ||
    !command ||
    !["draft", "review", "release", "revoke"].includes(command)
  )
    throw new Error(
      "Usage: candidate-research <draft|review|release|revoke> <json-file> [--write]. Without --write, validate only.",
    );
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  const parsed =
    command === "draft"
      ? candidateBriefSchema.parse(value)
      : command === "review"
        ? reviewSchema.parse(value)
        : command === "release"
          ? candidateRaceManifestSchema.parse(value)
          : revokeSchema.parse(value);
  if (writeFlag !== "--write") {
    console.log("Valid document. No database writes performed.");
    return;
  }
  const target = new URL(process.env.POSTGRES_URL ?? "");
  console.log(
    `Database target: ${target.hostname}:${target.port || "5432"}${target.pathname}`,
  );
  if (command === "draft") console.log(await storeCandidateBriefDraft(parsed));
  else if (command === "review")
    console.log(await recordCandidateBriefReview(reviewSchema.parse(parsed)));
  else if (command === "release")
    console.log(await releaseCandidateRace(parsed));
  else {
    const revoke = revokeSchema.parse(parsed);
    await revokeCandidateRace(revoke.releaseId, revoke.reason);
    console.log("Race revoked.");
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Candidate research operation failed",
  );
  process.exitCode = 1;
});
