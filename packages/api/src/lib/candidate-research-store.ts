import { createHash, randomUUID } from "node:crypto";

import type { CandidateResearchCollectionDocument } from "@acme/validators";
import { and, desc, eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CaliforniaRaceWork,
  CaliforniaRoster,
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

import { getLatestPublicCaliforniaRoster } from "./california-public-roster";
import {
  getCurrentCaliforniaRosterId,
  invalidateCaliforniaResearchState,
} from "./california-roster-store";
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
  manifest: Pick<
    CandidateResearchCollectionDocument["manifest"],
    "jurisdiction" | "electionDate" | "contestId"
  >,
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
  reviewEpoch: number;
}
async function activeResearchWorkLease(
  tx: ResearchTransaction,
  lease: ResearchWorkLease,
  pilotKey: string,
) {
  const [work] = await tx
    .select()
    .from(CaliforniaRaceWork)
    .where(eq(CaliforniaRaceWork.key, lease.key))
    .for("update");
  if (
    work?.owner !== lease.owner ||
    work.generation !== lease.generation ||
    work.reviewEpoch !== lease.reviewEpoch ||
    work.status !== "running" ||
    !work.leaseUntil ||
    work.leaseUntil.getTime() <= Date.now() ||
    work.raceKey !== pilotKey
  )
    throw new Error("Research work lease expired or was superseded");
  return work;
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
  const work = await activeResearchWorkLease(tx, lease, document.pilotKey);
  if (
    !sourceFailure &&
    (work.policyVersion !== document.manifest.policyVersion ||
      work.snapshotId !== document.rosterSnapshotId ||
      work.rosterDigest !== document.rosterDigest ||
      work.researchVersion !== document.researchVersion)
  )
    throw new Error("Research work lease expired or was superseded");
}
export async function resolveCurrentResearchRoster(
  database: Pick<ResearchDatabase, "select">,
  manifest: CandidateResearchCollectionDocument["manifest"],
) {
  const snapshot = await getLatestPublicCaliforniaRoster(
    database,
    manifest.electionDate,
  );
  const race = snapshot?.races.find(
    (r) =>
      r.contestId === manifest.contestId &&
      r.jurisdiction === manifest.jurisdiction,
  );
  return snapshot && race
    ? {
        snapshotId: snapshot.id,
        rosterDigest: race.rosterDigest,
        candidateIds: race.members.map((m) => m.candidateId),
        contestId: race.contestId,
        electionDate: race.electionDate,
        jurisdiction: race.jurisdiction,
      }
    : undefined;
}
export async function requireFreshResearchReview(
  tx: ResearchTransaction,
  pilotKey: string,
  reason = "Independent review is required",
) {
  await tx
    .update(CaliforniaRaceWork)
    .set({
      generation: sql`${CaliforniaRaceWork.generation}+1`,
      reviewEpoch: sql`${CaliforniaRaceWork.reviewEpoch}+1`,
      owner: null,
      leaseUntil: null,
      status: "pending",
      checkpoint: sql`coalesce(${CaliforniaRaceWork.checkpoint}, '{}'::jsonb) || ${JSON.stringify({ reason, kind: "required_independent_review" })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(CaliforniaRaceWork.raceKey, pilotKey));
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
  const modern =
    document.researchVersion !== undefined ||
    document.rosterSnapshotId !== undefined ||
    document.candidateArtifacts !== undefined;
  const semantic: unknown[] = [
    document.researchVersion ?? candidateResearchTemplateVersion,
    document.sources
      .map((s) => [
        s.id,
        s.url,
        s.publisher,
        s.format,
        s.contentHash,
        ...(modern && s.format === "image" && s.byteHash ? [s.byteHash] : []),
      ])
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
    if (
      source.binaryBase64 &&
      createHash("sha256")
        .update(Buffer.from(source.binaryBase64, "base64"))
        .digest("hex") !== source.byteHash
    )
      throw new Error(
        "Collected source byte hash does not match its binary archive",
      );
    const age =
      Date.parse(document.manifest.sourceCheckedAt) -
      Date.parse(source.fetchedAt);
    if (age < 0 || age > 86_400_000)
      throw new Error("Collected source is stale or future dated");
  }
  const sourceDigest = researchSourceDigest(document);
  return database.transaction(async (tx) => {
    await lockPilot(tx, "policy");
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
            currentRoster: await resolveCurrentResearchRoster(tx, manifest),
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
  if (!reason.trim()) throw new Error("Required source failure needs a reason");
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
    const lease = options?.workLease;
    let electionDate = selected?.document.manifest.electionDate;
    if (!electionDate && lease) {
      const [scope] = await tx
        .select({ electionDate: CaliforniaRoster.electionDate })
        .from(CaliforniaRaceWork)
        .innerJoin(
          CaliforniaRoster,
          eq(CaliforniaRoster.id, CaliforniaRaceWork.snapshotId),
        )
        .where(eq(CaliforniaRaceWork.key, lease.key));
      if (!scope)
        throw new Error("Research work lease expired or was superseded");
      electionDate = scope.electionDate;
    }
    if (!electionDate) return;
    await lockResearchElection(tx, electionDate);
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
    if (prior) {
      if (prior.document.manifest.electionDate !== electionDate)
        throw new Error("Research collection election changed");
      await lockResearchRace(tx, prior.document.manifest);
      await assertResearchWorkLease(tx, lease, prior.document, true);
      await invalidateRace(tx, prior.document.manifest, reason);
      await requireFreshResearchReview(tx, prior.pilotKey, reason);
      await tx
        .update(CandidateResearchCollection)
        .set({ failure: reason })
        .where(eq(CandidateResearchCollection.id, prior.id));
      return;
    }
    if (!lease) return;
    const [candidateWork] = await tx
      .select()
      .from(CaliforniaRaceWork)
      .where(eq(CaliforniaRaceWork.key, lease.key));
    if (!candidateWork)
      throw new Error("Research work lease expired or was superseded");
    const [scope] = await tx
      .select({
        electionDate: CaliforniaRoster.electionDate,
        races: sql<
          {
            raceKey: string;
            contestId: string;
            jurisdiction: string;
            electionDate: string;
          }[]
        >`(select coalesce(jsonb_agg(jsonb_build_object('raceKey',r->>'raceKey','contestId',r->>'contestId','jurisdiction',r->>'jurisdiction','electionDate',r->>'electionDate')),'[]'::jsonb) from jsonb_array_elements(${CaliforniaRoster.document}->'races') r where r->>'raceKey'=${pilotKey})`,
      })
      .from(CaliforniaRoster)
      .where(eq(CaliforniaRoster.id, candidateWork.snapshotId));
    const race = scope?.races[0];
    if (
      scope?.electionDate !== electionDate ||
      scope.races.length !== 1 ||
      race?.electionDate !== electionDate ||
      (await getCurrentCaliforniaRosterId(tx, electionDate)) !==
        candidateWork.snapshotId
    )
      throw new Error(
        "Required source failure does not belong to the current authoritative race",
      );
    await lockResearchRace(tx, race);
    await activeResearchWorkLease(tx, lease, pilotKey);
    await requireFreshResearchReview(tx, pilotKey, reason);
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
