import { createHash, randomUUID } from "node:crypto";

import type { CandidateResearchCollectionDocument } from "@acme/validators";
import { and, desc, eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CaliforniaRaceWork,
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
  CandidateResearchCollection,
  CandidateResearchPolicy,
} from "@acme/db/schema";
import {
  candidateModelAttestationSchema,
  candidateResearchCollectionSchema,
  candidateResearchTemplateVersion,
} from "@acme/validators";

import { invalidateCaliforniaResearchState } from "./california-roster-store";
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
export const lockResearchElection = (
  tx: ResearchTransaction,
  electionDate: string,
) => lockPilot(tx, `election:${electionDate}`);
export async function lockResearchRace(
  tx: ResearchTransaction,
  manifest: CandidateResearchCollectionDocument["manifest"],
) {
  await lockPilot(
    tx,
    `race:${JSON.stringify([manifest.jurisdiction, manifest.electionDate, manifest.contestId])}`,
  );
}
export interface ResearchWorkLease {
  key: string;
  owner: string;
  generation: number;
}
export async function assertResearchWorkLease(
  tx: ResearchTransaction,
  lease: ResearchWorkLease | undefined,
  document: CandidateResearchCollectionDocument,
  sourceFailure = false,
) {
  if (!lease) {
    if (document.candidateArtifacts)
      throw new Error("Automated research requires a current work lease");
    return;
  }
  const [work] = await tx
    .select()
    .from(CaliforniaRaceWork)
    .where(eq(CaliforniaRaceWork.key, lease.key))
    .for("update");
  if (
    work?.owner !== lease.owner ||
    work.generation !== lease.generation ||
    !work.leaseUntil ||
    work.leaseUntil.getTime() <= Date.now() ||
    work.raceKey !== document.pilotKey ||
    (!sourceFailure &&
      (work.policyVersion !== document.manifest.policyVersion ||
        work.snapshotId !== document.rosterSnapshotId ||
        work.rosterDigest !== document.rosterDigest ||
        work.researchVersion !== document.researchVersion))
  )
    throw new Error("Research work lease expired or was superseded");
}
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
    ? { approved: true, version: policy.version, automation: policy.automation }
    : candidatePublicationPolicy;
}
export function researchSourceDigest(
  document: CandidateResearchCollectionDocument,
) {
  const semantic: unknown[] = [
    document.researchVersion ?? candidateResearchTemplateVersion,
    document.sources
      .map((s) => [s.id, s.url, s.publisher, s.format, s.contentHash])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    document.problems,
  ];
  if (
    document.researchVersion ||
    document.rosterSnapshotId ||
    document.candidateArtifacts
  )
    semantic.push([
      document.rosterSnapshotId ?? null,
      document.rosterDigest ?? null,
      document.candidateArtifacts
        ?.map(
          (a) =>
            [
              a.candidateId,
              a.dossierDigest,
              a.sourceSetDigest,
              candidateModelAttestationSchema.parse(a.author),
            ] as const,
        )
        .sort((a, b) => a[0].localeCompare(b[0])) ?? [],
    ]);
  return createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
}
export async function saveResearchCollection(
  value: unknown,
  database: ResearchDatabase = db,
  options?: { workLease?: ResearchWorkLease; stagedPolicyVersion?: string },
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
  const sourceDigest = researchSourceDigest(document);
  return database.transaction(async (tx) => {
    await lockResearchElection(tx, document.manifest.electionDate);
    await lockPilot(tx, document.pilotKey);
    await lockResearchRace(tx, document.manifest);
    await assertResearchWorkLease(tx, options?.workLease, document);
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
    let preserveExisting = false;
    if (
      options?.stagedPolicyVersion &&
      !document.problems.length &&
      options.stagedPolicyVersion !== (await activeResearchPolicy(tx)).version
    ) {
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
        release.document.members.length === document.manifest.members.length &&
        release.document.members.every((m) =>
          document.manifest.members.some(
            (n) => n.candidateId === m.candidateId,
          ),
        ) &&
        document.sources.some(
          (s) =>
            s.url === release.document.rosterSourceUrl &&
            s.contentHash === release.document.rosterHash,
        )
      ) {
        const revisions = await tx
          .select()
          .from(CandidateBriefRevision)
          .where(
            inArray(
              CandidateBriefRevision.id,
              release.document.members.map((m) => m.revisionId),
            ),
          );
        preserveExisting =
          revisions.length === release.document.members.length &&
          revisions.every((r) =>
            r.document.evidence.every((e) =>
              document.sources.some(
                (s) =>
                  s.url === e.url &&
                  s.contentHash === e.contentHash &&
                  s.text.includes(e.excerpt),
              ),
            ),
          );
      }
    }
    if (!preserveExisting)
      await invalidateRace(
        tx,
        document.manifest,
        "Source collection changed; independent review required",
      );
    for (const brief of document.briefs) {
      await tx
        .insert(CandidateBriefRevision)
        .values({
          id: brief.revisionId,
          identityKey: briefIdentityKey(brief.identity),
          revisionDigest: briefDigest(brief),
          document: brief,
        })
        .onConflictDoNothing();
      const [stored] = await tx
        .select()
        .from(CandidateBriefRevision)
        .where(eq(CandidateBriefRevision.id, brief.revisionId));
      if (stored?.revisionDigest !== briefDigest(brief))
        throw new Error(
          "Immutable revision identity conflicts with existing content",
        );
    }
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
  options?: { workLease?: ResearchWorkLease; stagedPolicyVersion?: string },
) {
  await database.transaction(async (tx) => {
    const [selected] = await tx
      .select()
      .from(CandidateResearchCollection)
      .where(eq(CandidateResearchCollection.pilotKey, pilotKey))
      .orderBy(
        desc(CandidateResearchCollection.createdAt),
        desc(CandidateResearchCollection.id),
      )
      .limit(1);
    if (!selected) return;
    await lockResearchElection(tx, selected.document.manifest.electionDate);
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
    await lockResearchRace(tx, prior.document.manifest);
    await assertResearchWorkLease(tx, options?.workLease, prior.document, true);
    await invalidateRace(tx, prior.document.manifest, reason);
    await tx
      .update(CandidateResearchCollection)
      .set({ failure: reason })
      .where(eq(CandidateResearchCollection.id, prior.id));
  });
}

export async function invalidateResearchElection(
  input: { electionDate: string; snapshotId?: string; reason: string },
  database: ResearchDatabase = db,
) {
  return database.transaction((tx) =>
    invalidateCaliforniaResearchState(tx, input),
  );
}
