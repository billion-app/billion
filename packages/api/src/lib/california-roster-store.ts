import { createHash } from "node:crypto";

import type { db } from "@acme/db/client";
import type { CaliforniaRosterSnapshot } from "@acme/validators";
import { and, desc, eq, gt, isNull, lte, or, sql } from "@acme/db";
import {
  CaliforniaRaceWork,
  CaliforniaResearchArtifact,
  CaliforniaRoster,
} from "@acme/db/schema";
import { californiaRosterSnapshotSchema } from "@acme/validators";

type Reader = Pick<typeof db, "select">;
type Writer = Pick<typeof db, "select" | "insert" | "update">;
export async function getLatestCaliforniaRoster(
  database: Reader,
  electionDate: string,
) {
  const [row] = await database
    .select()
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.electionDate, electionDate))
    .orderBy(desc(CaliforniaRoster.createdAt), desc(CaliforniaRoster.id))
    .limit(1);
  return row ? californiaRosterSnapshotSchema.parse(row.document) : null;
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
) {
  const snapshot = californiaRosterSnapshotSchema.parse(value);
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`candidate-research:roster:${snapshot.electionDate}`}))`,
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
export async function claimCaliforniaRaceWork(
  database: Writer,
  input: {
    snapshotId: string;
    raceKey: string;
    rosterDigest: string;
    policyVersion: string;
    researchVersion: string;
    owner: string;
    now?: Date;
    leaseMs?: number;
  },
) {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? 900_000;
  if (!input.owner.trim() || leaseMs < 1000 || leaseMs > 3_600_000)
    throw new Error("Invalid race lease");
  const key = californiaRaceWorkKey(input);
  await database
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
  const [row] = await database
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
    .where(eq(CaliforniaRaceWork.snapshotId, snapshotId));
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
