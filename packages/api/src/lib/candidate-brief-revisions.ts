import { randomUUID } from "node:crypto";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
} from "@acme/db/schema";
import { candidateBriefSchema } from "@acme/validators";

import { briefDigest, briefIdentityKey } from "./candidate-brief-publication";

/** Trusted editorial operator only. Not exposed through public or protected tRPC. */
export async function storeCandidateBriefDraft(value: unknown) {
  const brief = candidateBriefSchema.parse(value);
  return db.transaction(async (tx) => {
    if (brief.supersedes) {
      const [prior] = await tx
        .select()
        .from(CandidateBriefRevision)
        .where(eq(CandidateBriefRevision.id, brief.supersedes));
      if (prior?.identityKey !== briefIdentityKey(brief.identity))
        throw new Error(
          "Superseded revision must have the same candidate and race identity",
        );
    }
    await tx.insert(CandidateBriefRevision).values({
      id: brief.revisionId,
      identityKey: briefIdentityKey(brief.identity),
      revisionDigest: briefDigest(brief),
      document: brief,
    });
    return { revisionId: brief.revisionId, revisionDigest: briefDigest(brief) };
  });
}

/** Append an audit event; approval is not a publication switch. Caller must enforce editorial authorization. */
export async function recordCandidateBriefReview(input: {
  revisionId: string;
  actorId: string;
  action: "approve" | "withdraw";
  policyVersion: string;
  reason: string;
}) {
  if (
    !input.actorId.trim() ||
    !input.policyVersion.trim() ||
    !input.reason.trim()
  )
    throw new Error("Review requires actor, policy and reason");
  const [revision] = await db
    .select()
    .from(CandidateBriefRevision)
    .where(eq(CandidateBriefRevision.id, input.revisionId));
  if (!revision) throw new Error("Unknown revision");
  const brief = candidateBriefSchema.parse(revision.document);
  if (input.action === "approve" && input.actorId.trim() === brief.authorId)
    throw new Error("Author cannot approve their own revision");
  const id = randomUUID();
  await db
    .insert(CandidateBriefReviewEvent)
    .values({ ...input, actorId: input.actorId.trim(), id });
  return { eventId: id, revisionDigest: revision.revisionDigest };
}
