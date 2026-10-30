import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CandidateRaceRelease } from "@acme/db/schema";

import { publishResearchManifest } from "./candidate-research-service";

/** Trusted editorial operator only; never exposed as a public mutation. */
export async function releaseCandidateRace(value: unknown) {
  return publishResearchManifest(value);
}
/** Source changes/fetch failures and corrections revoke the full release before re-review. */
export async function revokeCandidateRace(releaseId: string, reason: string) {
  if (!reason.trim()) throw new Error("Revocation requires a reason");
  await db
    .update(CandidateRaceRelease)
    .set({ revokedReason: reason.trim() })
    .where(eq(CandidateRaceRelease.id, releaseId));
}
