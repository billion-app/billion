import { eq, inArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
} from "@acme/db/schema";
import { candidateRaceManifestSchema } from "@acme/validators";

import { readCandidateRace } from "./candidate-race-release";
import { activeResearchPolicy } from "./candidate-research-store";

/** Trusted editorial operator only; never exposed as a public mutation. */
export async function releaseCandidateRace(value: unknown) {
  const manifest = candidateRaceManifestSchema.parse(value);
  return db.transaction(async (tx) => {
    const policy = await activeResearchPolicy(tx);
    if (!policy.approved) throw new Error("Publication policy is not approved");
    const ids = manifest.members.map((m) => m.revisionId);
    const revisions = await tx
      .select()
      .from(CandidateBriefRevision)
      .where(inArray(CandidateBriefRevision.id, ids));
    const events = await tx
      .select()
      .from(CandidateBriefReviewEvent)
      .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
    const published = readCandidateRace({
      manifest,
      revokedReason: null,
      revisions,
      events,
      now: new Date().toISOString(),
      policy,
    });
    if (!published)
      throw new Error(
        "Race is incomplete, unreviewed, withdrawn, or its sources are not current",
      );
    await tx
      .insert(CandidateRaceRelease)
      .values({ id: manifest.id, document: manifest });
    return { releaseId: manifest.id };
  });
}
/** Source changes/fetch failures and corrections revoke the full release before re-review. */
export async function revokeCandidateRace(releaseId: string, reason: string) {
  if (!reason.trim()) throw new Error("Revocation requires a reason");
  await db
    .update(CandidateRaceRelease)
    .set({ revokedReason: reason.trim() })
    .where(eq(CandidateRaceRelease.id, releaseId));
}
