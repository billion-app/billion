import { createHash } from "node:crypto";

import type { db } from "@acme/db/client";
import type {
  CaliforniaRosterSnapshot,
  CandidateResearchCollectionDocument,
} from "@acme/validators";
import { and, desc, eq, gt, inArray, isNull, lte, ne, or, sql } from "@acme/db";
import {
  CaliforniaRaceWork,
  CaliforniaResearchArtifact,
  CaliforniaRoster,
  CandidateRaceRelease,
  CandidateResearchCollection,
} from "@acme/db/schema";
import { californiaRosterSnapshotSchema } from "@acme/validators";

type Reader = Pick<typeof db, "select">;
type Writer = Pick<typeof db, "select" | "insert" | "update">;
export async function getCurrentCaliforniaRosterId(
  database: Reader,
  electionDate: string,
): Promise<string | null> {
  const [pointer] = await database
    .select({ snapshotId: CaliforniaRaceWork.snapshotId })
    .from(CaliforniaRaceWork)
    .where(eq(CaliforniaRaceWork.key, `source-epoch:${electionDate}`));
  if (pointer) return pointer.snapshotId;
  const [latest] = await database
    .select({ id: CaliforniaRoster.id })
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.electionDate, electionDate))
    .orderBy(desc(CaliforniaRoster.createdAt), desc(CaliforniaRoster.id))
    .limit(1);
  return latest?.id ?? null;
}
export async function getLatestCaliforniaRoster(
  database: Reader,
  electionDate: string,
) {
  const id = await getCurrentCaliforniaRosterId(database, electionDate);
  return id ? getCaliforniaRoster(database, id) : null;
}
export async function getCaliforniaRoster(database: Reader, id: string) {
  const [row] = await database
    .select()
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.id, id))
    .limit(1);
  return row ? californiaRosterSnapshotSchema.parse(row.document) : null;
}
export async function saveCaliforniaRoster(
  database: Pick<typeof db, "transaction">,
  value: CaliforniaRosterSnapshot,
  options?: { expectedSourceEpoch?: CaliforniaSourceEpoch },
) {
  const snapshot = californiaRosterSnapshotSchema.parse(value);
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:election:${snapshot.electionDate}`}))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:roster:${snapshot.electionDate}`}))`,
    );
    if (options?.expectedSourceEpoch) {
      const epochKey = `source-epoch:${snapshot.electionDate}`;
      const [epoch] = await tx
        .select({ generation: CaliforniaRaceWork.generation })
        .from(CaliforniaRaceWork)
        .where(eq(CaliforniaRaceWork.key, epochKey));
      if (
        !epoch ||
        options.expectedSourceEpoch.key !== epochKey ||
        options.expectedSourceEpoch.generation !== epoch.generation
      )
        throw new Error(
          "Shared source check was superseded before roster persistence",
        );
    }
    const priorId = await getCurrentCaliforniaRosterId(
      tx,
      snapshot.electionDate,
    );
    await tx
      .insert(CaliforniaRoster)
      .values({
        id: snapshot.id,
        electionDate: snapshot.electionDate,
        document: snapshot,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
    await tx
      .insert(CaliforniaRaceWork)
      .values({
        key: `source-epoch:${snapshot.electionDate}`,
        snapshotId: snapshot.id,
        raceKey: "__source_epoch__",
        rosterDigest: snapshot.id,
        policyVersion: "source-epoch",
        researchVersion: "source-epoch",
        status: "source_epoch",
      })
      .onConflictDoUpdate({
        target: CaliforniaRaceWork.key,
        set: {
          snapshotId: snapshot.id,
          rosterDigest: snapshot.id,
          updatedAt: new Date(),
        },
      });
    if (priorId && priorId !== snapshot.id)
      await invalidateCaliforniaResearchState(tx, {
        electionDate: snapshot.electionDate,
        snapshotId: snapshot.id,
        reason:
          "Authoritative roster snapshot changed; renewed independent review required",
      });
    const stored = await getCaliforniaRoster(tx, snapshot.id);
    if (!stored) throw new Error("Roster insert did not persist");
    return stored;
  });
}
export function californiaRaceWorkKey(input: {
  snapshotId: string;
  raceKey: string;
  rosterDigest: string;
  policyVersion: string;
  researchVersion: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.snapshotId,
        input.raceKey,
        input.rosterDigest,
        input.policyVersion,
        input.researchVersion,
      ]),
    )
    .digest("hex");
}
export interface CaliforniaSourceEpoch {
  key: string;
  generation: number;
}
export async function beginCaliforniaSourceCheck(
  database: Pick<typeof db, "transaction">,
  electionDate: string,
): Promise<CaliforniaSourceEpoch | null> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:election:${electionDate}`}))`,
    );
    const latestId = await getCurrentCaliforniaRosterId(tx, electionDate);
    if (!latestId) return null;
    const key = `source-epoch:${electionDate}`;
    await tx
      .insert(CaliforniaRaceWork)
      .values({
        key,
        snapshotId: latestId,
        raceKey: "__source_epoch__",
        rosterDigest: latestId,
        policyVersion: "source-epoch",
        researchVersion: "source-epoch",
        status: "source_epoch",
      })
      .onConflictDoNothing();
    const [row] = await tx
      .select({ generation: CaliforniaRaceWork.generation })
      .from(CaliforniaRaceWork)
      .where(eq(CaliforniaRaceWork.key, key));
    if (!row) throw new Error("Source epoch did not persist");
    return { key, generation: row.generation };
  });
}
export async function claimCaliforniaRaceWork(
  database: Pick<typeof db, "transaction">,
  input: {
    snapshotId: string;
    raceKey: string;
    rosterDigest: string;
    policyVersion: string;
    researchVersion: string;
    owner: string;
    now?: Date;
    leaseMs?: number;
    expectedSourceEpoch?: CaliforniaSourceEpoch;
  },
) {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? 900_000;
  if (!input.owner.trim() || leaseMs < 1000 || leaseMs > 3_600_000)
    throw new Error("Invalid race lease");
  return database.transaction(async (tx) => {
    const [snapshot] = await tx
      .select({ electionDate: CaliforniaRoster.electionDate })
      .from(CaliforniaRoster)
      .where(eq(CaliforniaRoster.id, input.snapshotId));
    if (!snapshot) throw new Error("Unknown roster snapshot");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:election:${snapshot.electionDate}`}))`,
    );
    const currentId = await getCurrentCaliforniaRosterId(
      tx,
      snapshot.electionDate,
    );
    if (currentId !== input.snapshotId)
      throw new Error("Roster snapshot was superseded before the race lease");
    const epochKey = `source-epoch:${snapshot.electionDate}`;
    const [epoch] = await tx
      .select({ generation: CaliforniaRaceWork.generation })
      .from(CaliforniaRaceWork)
      .where(eq(CaliforniaRaceWork.key, epochKey));
    if (
      epoch &&
      (input.expectedSourceEpoch?.key !== epochKey ||
        input.expectedSourceEpoch.generation !== epoch.generation)
    )
      throw new Error(
        "Shared source check was superseded; fetch the required sources again",
      );
    if (!epoch && input.expectedSourceEpoch)
      throw new Error("Unknown shared source epoch");
    const key = californiaRaceWorkKey(input);
    await tx
      .insert(CaliforniaRaceWork)
      .values({
        key,
        snapshotId: input.snapshotId,
        raceKey: input.raceKey,
        rosterDigest: input.rosterDigest,
        policyVersion: input.policyVersion,
        researchVersion: input.researchVersion,
      })
      .onConflictDoNothing();
    const [row] = await tx
      .update(CaliforniaRaceWork)
      .set({
        owner: input.owner,
        generation: sql`${CaliforniaRaceWork.generation}+1`,
        status: "running",
        leaseUntil: new Date(now.getTime() + leaseMs),
        updatedAt: now,
      })
      .where(
        and(
          eq(CaliforniaRaceWork.key, key),
          or(
            isNull(CaliforniaRaceWork.leaseUntil),
            lte(CaliforniaRaceWork.leaseUntil, now),
          ),
        ),
      )
      .returning();
    return row ? { ...row, owner: input.owner } : null;
  });
}

export async function saveCaliforniaRaceCheckpoint(
  database: Writer,
  input: {
    key: string;
    owner: string;
    generation: number;
    status: "pending" | "blocked" | "complete";
    checkpoint: unknown;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const rows = await database
    .update(CaliforniaRaceWork)
    .set({
      checkpoint: input.checkpoint,
      status: input.status,
      owner: null,
      leaseUntil: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(CaliforniaRaceWork.key, input.key),
        eq(CaliforniaRaceWork.owner, input.owner),
        eq(CaliforniaRaceWork.generation, input.generation),
        gt(CaliforniaRaceWork.leaseUntil, now),
      ),
    )
    .returning({ key: CaliforniaRaceWork.key });
  return rows.length === 1;
}
export async function listCaliforniaRaceWork(
  database: Reader,
  snapshotId: string,
) {
  return database
    .select()
    .from(CaliforniaRaceWork)
    .where(
      and(
        eq(CaliforniaRaceWork.snapshotId, snapshotId),
        ne(CaliforniaRaceWork.raceKey, "__source_epoch__"),
      ),
    );
}
export async function getCaliforniaResearchArtifact(
  database: Reader,
  key: string,
): Promise<unknown> {
  const [row] = await database
    .select()
    .from(CaliforniaResearchArtifact)
    .where(eq(CaliforniaResearchArtifact.key, key))
    .limit(1);
  return row?.document ?? null;
}
export async function saveCaliforniaResearchArtifact(
  database: Writer,
  input: {
    key: string;
    kind: string;
    raceKey: string;
    candidateId?: string;
    document: unknown;
  },
) {
  await database
    .insert(CaliforniaResearchArtifact)
    .values(input)
    .onConflictDoNothing();
  return getCaliforniaResearchArtifact(database, input.key);
}

export async function invalidateCaliforniaResearchState(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: { electionDate: string; snapshotId?: string; reason: string },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.electionDate) || !input.reason.trim())
    throw new Error("Election invalidation requires a date and reason");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:election:${input.electionDate}`}))`,
  );
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:roster:${input.electionDate}`}))`,
  );
  const snapshots = await tx
    .select({
      id: CaliforniaRoster.id,
      races: sql<
        { contestId: string; jurisdiction: string; electionDate: string }[]
      >`${CaliforniaRoster.document}->'races'`,
    })
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.electionDate, input.electionDate))
    .orderBy(desc(CaliforniaRoster.createdAt), desc(CaliforniaRoster.id));
  const currentSnapshotId = await getCurrentCaliforniaRosterId(
    tx,
    input.electionDate,
  );
  if (input.snapshotId && currentSnapshotId !== input.snapshotId)
    throw new Error(
      "Election invalidation was superseded by a newer roster snapshot",
    );
  const keys = new Set(
    snapshots.flatMap((snapshot) =>
      snapshot.races.map((r) =>
        JSON.stringify([r.jurisdiction, r.electionDate, r.contestId]),
      ),
    ),
  );
  const matches = (manifest: CandidateResearchCollectionDocument["manifest"]) =>
    manifest.contestId.startsWith(`ca-sos:${input.electionDate}:`) ||
    keys.has(
      JSON.stringify([
        manifest.jurisdiction,
        manifest.electionDate,
        manifest.contestId,
      ]),
    );
  const collections = await tx
    .select({
      id: CandidateResearchCollection.id,
      manifest: sql<
        CandidateResearchCollectionDocument["manifest"]
      >`${CandidateResearchCollection.document}->'manifest'`,
    })
    .from(CandidateResearchCollection)
    .where(
      sql`${CandidateResearchCollection.document}->'manifest'->>'electionDate' = ${input.electionDate}`,
    );
  const releases = await tx
    .select({
      id: CandidateRaceRelease.id,
      manifest: CandidateRaceRelease.document,
    })
    .from(CandidateRaceRelease)
    .where(
      sql`${CandidateRaceRelease.document}->>'electionDate' = ${input.electionDate}`,
    );
  const collectionIds = collections
    .filter((r) => matches(r.manifest))
    .map((r) => r.id);
  const releaseIds = releases
    .filter((r) => matches(r.manifest))
    .map((r) => r.id);
  if (collectionIds.length)
    await tx
      .update(CandidateResearchCollection)
      .set({ failure: input.reason })
      .where(inArray(CandidateResearchCollection.id, collectionIds));
  if (releaseIds.length)
    await tx
      .update(CandidateRaceRelease)
      .set({ revokedReason: input.reason })
      .where(inArray(CandidateRaceRelease.id, releaseIds));
  if (snapshots.length)
    await tx
      .update(CaliforniaRaceWork)
      .set({
        generation: sql`${CaliforniaRaceWork.generation}+1`,
        reviewEpoch: sql`${CaliforniaRaceWork.reviewEpoch}+1`,
        owner: null,
        leaseUntil: null,
        status: "blocked",
        checkpoint: sql`coalesce(${CaliforniaRaceWork.checkpoint}, '{}'::jsonb) || ${JSON.stringify({ reason: input.reason, kind: "required_roster_source_failure" })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          CaliforniaRaceWork.snapshotId,
          snapshots.map((s) => s.id),
        ),
      );
  return {
    collections: collectionIds.length,
    releases: releaseIds.length,
    snapshotId: currentSnapshotId,
  };
}
