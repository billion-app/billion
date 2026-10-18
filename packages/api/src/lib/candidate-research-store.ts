import { createHash, randomUUID } from "node:crypto";

import type { CandidateResearchCollectionDocument } from "@acme/validators";
import { and, desc, eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
  CandidateResearchCollection,
  CandidateResearchPolicy,
} from "@acme/db/schema";
import {
  candidateResearchCollectionSchema,
  candidateResearchTemplateVersion,
} from "@acme/validators";

import { briefDigest, briefIdentityKey } from "./candidate-brief-publication";
import {
  candidatePublicationPolicy,
  readCandidateRace,
} from "./candidate-race-release";

export type ResearchDatabase = typeof db;
export type ResearchTransaction = Parameters<
  Parameters<ResearchDatabase["transaction"]>[0]
>[0];
export const lockPilot = (tx: ResearchTransaction, key: string) =>
  tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:${key}`}))`,
  );
export function invalidateRace(
  tx: ResearchTransaction,
  manifest: CandidateResearchCollectionDocument["manifest"],
  reason: string,
) {
  return tx
    .update(CandidateRaceRelease)
    .set({ revokedReason: reason })
    .where(
      and(
        sql`${CandidateRaceRelease.document}->>'contestId' = ${manifest.contestId}`,
        sql`${CandidateRaceRelease.document}->>'jurisdiction' = ${manifest.jurisdiction}`,
        sql`${CandidateRaceRelease.document}->>'electionDate' = ${manifest.electionDate}`,
      ),
    );
}
export async function activeResearchPolicy(
  database: Pick<ResearchDatabase, "select"> = db,
) {
  // The latest policy decision wins; revocation never revives an older version.
  const [policy] = await database
    .select()
    .from(CandidateResearchPolicy)
    .orderBy(
      desc(CandidateResearchPolicy.createdAt),
      desc(CandidateResearchPolicy.version),
    )
    .limit(1);
  return policy && !policy.revokedAt
    ? { approved: true, version: policy.version }
    : candidatePublicationPolicy;
}
export async function saveResearchCollection(
  value: unknown,
  database: ResearchDatabase = db,
) {
  const document = candidateResearchCollectionSchema.parse(value);
  for (const source of document.sources) {
    if (
      createHash("sha256").update(source.text).digest("hex") !==
      source.contentHash
    )
      throw new Error("Collected source hash does not match its text");
    const age =
      Date.parse(document.manifest.sourceCheckedAt) -
      Date.parse(source.fetchedAt);
    if (age < 0 || age > 86_400_000)
      throw new Error("Collected source is stale or future dated");
  }
  const sourceDigest = createHash("sha256")
    .update(
      JSON.stringify([
        candidateResearchTemplateVersion,
        document.sources
          .map((s) => [s.id, s.url, s.publisher, s.format, s.contentHash])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        document.problems,
      ]),
    )
    .digest("hex");
  return database.transaction(async (tx) => {
    await lockPilot(tx, document.pilotKey);
    const [prior] = await tx
      .select()
      .from(CandidateResearchCollection)
      .where(eq(CandidateResearchCollection.pilotKey, document.pilotKey))
      .orderBy(
        desc(CandidateResearchCollection.createdAt),
        desc(CandidateResearchCollection.id),
      )
      .limit(1);
    const checkedAt = new Date(document.manifest.sourceCheckedAt);
    if (prior?.sourceDigest === sourceDigest && !prior.failure) {
      await tx
        .update(CandidateResearchCollection)
        .set({ checkedAt })
        .where(eq(CandidateResearchCollection.id, prior.id));
      const [release] = await tx
        .select()
        .from(CandidateRaceRelease)
        .where(
          and(
            sql`${CandidateRaceRelease.document}->>'contestId' = ${document.manifest.contestId}`,
            sql`${CandidateRaceRelease.document}->>'jurisdiction' = ${document.manifest.jurisdiction}`,
            sql`${CandidateRaceRelease.document}->>'electionDate' = ${document.manifest.electionDate}`,
          ),
        )
        .orderBy(
          desc(CandidateRaceRelease.createdAt),
          desc(CandidateRaceRelease.id),
        )
        .limit(1);
      if (
        release &&
        !release.revokedReason &&
        !prior.document.problems.length &&
        prior.document.briefs.every((b) =>
          release.document.members.some((m) => m.revisionId === b.revisionId),
        )
      ) {
        const manifest = {
          ...release.document,
          id: release.id,
          sourceCheckedAt: checkedAt.toISOString(),
          expiresAt: new Date(checkedAt.getTime() + 86_400_000).toISOString(),
        };
        const ids = manifest.members.map((m) => m.revisionId);
        const revisions = await tx
          .select()
          .from(CandidateBriefRevision)
          .where(inArray(CandidateBriefRevision.id, ids));
        const events = await tx
          .select()
          .from(CandidateBriefReviewEvent)
          .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
        const policy = await activeResearchPolicy(tx);
        if (
          readCandidateRace({
            manifest,
            revokedReason: null,
            revisions,
            events,
            policy,
            now: checkedAt.toISOString(),
          })
        )
          await tx
            .update(CandidateRaceRelease)
            .set({ document: manifest })
            .where(eq(CandidateRaceRelease.id, release.id));
      }
      return {
        collectionId: prior.id,
        changed: false,
        candidates: prior.document.briefs.length,
        problems: prior.document.problems,
      };
    }
    // Any change, including recovery after a failed refresh, needs new approvals.
    await invalidateRace(
      tx,
      document.manifest,
      "Source collection changed; independent review required",
    );
    for (const brief of document.briefs)
      await tx.insert(CandidateBriefRevision).values({
        id: brief.revisionId,
        identityKey: briefIdentityKey(brief.identity),
        revisionDigest: briefDigest(brief),
        document: brief,
      });
    const id = randomUUID();
    await tx.insert(CandidateResearchCollection).values({
      id,
      pilotKey: document.pilotKey,
      sourceDigest,
      document,
      checkedAt,
      failure: document.problems.length ? document.problems.join(" ") : null,
    });
    return {
      collectionId: id,
      changed: true,
      candidates: document.briefs.length,
      problems: document.problems,
    };
  });
}
export async function failResearchRefresh(
  pilotKey: string,
  reason: string,
  database: ResearchDatabase = db,
) {
  await database.transaction(async (tx) => {
    await lockPilot(tx, pilotKey);
    const [prior] = await tx
      .select()
      .from(CandidateResearchCollection)
      .where(eq(CandidateResearchCollection.pilotKey, pilotKey))
      .orderBy(
        desc(CandidateResearchCollection.createdAt),
        desc(CandidateResearchCollection.id),
      )
      .limit(1);
    if (!prior) return;
    await invalidateRace(tx, prior.document.manifest, reason);
    await tx
      .update(CandidateResearchCollection)
      .set({ failure: reason })
      .where(eq(CandidateResearchCollection.id, prior.id));
  });
}
