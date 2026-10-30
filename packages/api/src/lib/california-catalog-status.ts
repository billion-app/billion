import { createHash } from "node:crypto";

import { and, desc, eq, inArray, sql } from "@acme/db";
import {
  CaliforniaRoster,
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
} from "@acme/db/schema";
import { candidateRaceManifestSchema } from "@acme/validators";

import type { createTRPCContext } from "../trpc";
import type { CatalogPublishedRace } from "./california-catalog";
import { getCaliforniaRoster } from "./california-roster-store";
import { readCandidateRace } from "./candidate-race-release";

type Database = Awaited<ReturnType<typeof createTRPCContext>>["db"];
export interface CatalogPolicy {
  approved: boolean;
  version: string;
  automation?: unknown;
}
export type CatalogPolicyInput =
  | CatalogPolicy
  | ((database: Pick<Database, "select">) => Promise<CatalogPolicy>);
export class CatalogStatusCache {
  private readonly entries = new Map<string, { from: number; until: number }>();
  constructor(private readonly maxEntries = 1024) {}
  has(key: string, now: number) {
    const entry = this.entries.get(key);
    if (entry === undefined) return false;
    if (now >= entry.until) {
      this.entries.delete(key);
      return false;
    }
    return now >= entry.from;
  }
  remember(key: string, expiresAt: number, validFrom: number) {
    this.entries.delete(key);
    this.entries.set(key, { from: validFrom, until: expiresAt });
    while (this.entries.size > this.maxEntries) {
      const first = this.entries.keys().next();
      if (first.done) break;
      this.entries.delete(first.value);
    }
  }
  get size() {
    return this.entries.size;
  }
}
export function catalogStatusKey(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export async function validateCatalogStatuses<T>(input: {
  candidates: { key: string; expiresAt: number; value: T }[];
  now: number;
  cache: CatalogStatusCache;
  validate: (missing: T[]) => Promise<Set<T>>;
}) {
  const eligible = input.candidates.filter(
    (candidate) => candidate.expiresAt > input.now,
  );
  const hits = new Set(
    eligible
      .filter((candidate) => input.cache.has(candidate.key, input.now))
      .map((candidate) => candidate.value),
  );
  const missing = eligible.filter((candidate) => !hits.has(candidate.value));
  const valid = missing.length
    ? await input.validate(missing.map((candidate) => candidate.value))
    : new Set<T>();
  for (const candidate of missing)
    if (valid.has(candidate.value))
      input.cache.remember(candidate.key, candidate.expiresAt, input.now);
  return eligible
    .filter(
      (candidate) => hits.has(candidate.value) || valid.has(candidate.value),
    )
    .map((candidate) => candidate.value);
}
const statusCache = new CatalogStatusCache();
const rosterCache = new Map<
  string,
  NonNullable<Awaited<ReturnType<typeof getCaliforniaRoster>>>
>();
async function catalogRoster(
  tx: Pick<Database, "select">,
  electionDate: string,
) {
  const [row] = await tx
    .select({
      id: CaliforniaRoster.id,
      fingerprint: sql<string>`md5(${CaliforniaRoster.document}::text)`,
    })
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.electionDate, electionDate))
    .orderBy(desc(CaliforniaRoster.createdAt), desc(CaliforniaRoster.id))
    .limit(1);
  if (!row) return null;
  const key = `${row.id}:${row.fingerprint}`;
  const cached = rosterCache.get(key);
  if (cached) return cached;
  const snapshot = await getCaliforniaRoster(tx, row.id);
  if (snapshot) {
    rosterCache.set(key, snapshot);
    while (rosterCache.size > 4) {
      const first = rosterCache.keys().next();
      if (first.done) break;
      rosterCache.delete(first.value);
    }
  }
  return snapshot;
}
export async function readCaliforniaCatalogStatuses(
  database: Pick<Database, "transaction">,
  policyInput: CatalogPolicyInput,
  electionDate: string,
) {
  return database.transaction(
    async (tx) => {
      const snapshot = await catalogRoster(tx, electionDate);
      const policy =
        typeof policyInput === "function" ? await policyInput(tx) : policyInput;
      if (!policy.approved || !snapshot)
        return { snapshot, races: [] as CatalogPublishedRace[] };
      const latest = tx
        .select({
          id: CandidateRaceRelease.id,
          fingerprint:
            sql<string>`md5(${CandidateRaceRelease.document}::text)`.as(
              "fingerprint",
            ),
          contestId:
            sql<string>`${CandidateRaceRelease.document}->>'contestId'`.as(
              "contest_id",
            ),
          jurisdiction:
            sql<string>`${CandidateRaceRelease.document}->>'jurisdiction'`.as(
              "jurisdiction",
            ),
          electionDate:
            sql<string>`${CandidateRaceRelease.document}->>'electionDate'`.as(
              "election_date",
            ),
          expiresAt:
            sql<string>`${CandidateRaceRelease.document}->>'expiresAt'`.as(
              "expires_at",
            ),
          members: sql<unknown>`${CandidateRaceRelease.document}->'members'`.as(
            "members",
          ),
          revokedReason: CandidateRaceRelease.revokedReason,
          rank: sql<number>`row_number() over (partition by ${CandidateRaceRelease.document}->>'jurisdiction', ${CandidateRaceRelease.document}->>'electionDate', ${CandidateRaceRelease.document}->>'contestId' order by ${CandidateRaceRelease.createdAt} desc,${CandidateRaceRelease.id} desc)`.as(
            "race_rank",
          ),
        })
        .from(CandidateRaceRelease)
        .as("catalog_latest_races");
      const stored = await tx
        .select({
          id: latest.id,
          fingerprint: latest.fingerprint,
          contestId: latest.contestId,
          jurisdiction: latest.jurisdiction,
          electionDate: latest.electionDate,
          expiresAt: latest.expiresAt,
          members: latest.members,
          revokedReason: latest.revokedReason,
        })
        .from(latest)
        .where(and(eq(latest.rank, 1), eq(latest.electionDate, electionDate)));
      const projected = stored.flatMap((row) => {
        if (row.revokedReason !== null) return [];
        const parsedMembers =
          candidateRaceManifestSchema.shape.members.safeParse(row.members);
        if (!parsedMembers.success) return [];
        const members = parsedMembers.data;
        const target = snapshot.races.find(
          (target) =>
            target.contestId === row.contestId &&
            target.jurisdiction === row.jurisdiction,
        );
        if (
          target?.members.length !== members.length ||
          target.members.some(
            (member) =>
              !members.some(
                (published) => published.candidateId === member.candidateId,
              ),
          )
        )
          return [];
        return [{ ...row, members, target }];
      });
      const ids = [
        ...new Set(
          projected.flatMap((row) =>
            row.members.map((member) => member.revisionId),
          ),
        ),
      ];
      if (!ids.length) return { snapshot, races: [] as CatalogPublishedRace[] };
      const revisionFingerprints = await tx
        .select({
          id: CandidateBriefRevision.id,
          digest: CandidateBriefRevision.revisionDigest,
          fingerprint: sql<string>`md5(${CandidateBriefRevision.document}::text)`,
        })
        .from(CandidateBriefRevision)
        .where(inArray(CandidateBriefRevision.id, ids));
      const eventFingerprints = await tx
        .select({
          revisionId: CandidateBriefReviewEvent.revisionId,
          fingerprint: sql<string>`md5(jsonb_build_array(${CandidateBriefReviewEvent.revisionId},${CandidateBriefReviewEvent.actorId},${CandidateBriefReviewEvent.action},${CandidateBriefReviewEvent.policyVersion},${CandidateBriefReviewEvent.createdAt},${CandidateBriefReviewEvent.attestation})::text)`,
        })
        .from(CandidateBriefReviewEvent)
        .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
      const now = Date.now();
      const valid = await validateCatalogStatuses({
        cache: statusCache,
        now,
        candidates: projected.map((row) => ({
          value: row,
          expiresAt: Date.parse(row.expiresAt),
          key: catalogStatusKey({
            version: 1,
            manifest: row.fingerprint,
            releaseId: row.id,
            policy,
            snapshotId: snapshot.id,
            target: row.target,
            revisionFingerprints: revisionFingerprints
              .filter((revision) =>
                row.members.some((member) => member.revisionId === revision.id),
              )
              .sort((a, b) => a.id.localeCompare(b.id)),
            eventFingerprints: eventFingerprints
              .filter((event) =>
                row.members.some(
                  (member) => member.revisionId === event.revisionId,
                ),
              )
              .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)),
          }),
        })),
        validate: async (missing) => {
          const missingIds = [
            ...new Set(
              missing.flatMap((row) =>
                row.members.map((member) => member.revisionId),
              ),
            ),
          ];
          const manifests = await tx
            .select()
            .from(CandidateRaceRelease)
            .where(
              inArray(
                CandidateRaceRelease.id,
                missing.map((row) => row.id),
              ),
            );
          const revisions = await tx
            .select()
            .from(CandidateBriefRevision)
            .where(inArray(CandidateBriefRevision.id, missingIds));
          const events = await tx
            .select()
            .from(CandidateBriefReviewEvent)
            .where(inArray(CandidateBriefReviewEvent.revisionId, missingIds));
          return new Set(
            missing.filter((row) => {
              const manifest = manifests.find(
                (manifest) => manifest.id === row.id,
              );
              if (!manifest) return false;
              const parsed = candidateRaceManifestSchema.safeParse(
                manifest.document,
              );
              return (
                parsed.success &&
                readCandidateRace({
                  manifest: parsed.data,
                  revokedReason: manifest.revokedReason,
                  revisions,
                  events,
                  policy,
                  now: new Date(now).toISOString(),
                  currentRoster: {
                    snapshotId: snapshot.id,
                    rosterDigest: row.target.rosterDigest,
                    candidateIds: row.target.members.map(
                      (member) => member.candidateId,
                    ),
                    contestId: row.target.contestId,
                    jurisdiction: row.target.jurisdiction,
                    electionDate: row.target.electionDate,
                  },
                }) !== null
              );
            }),
          );
        },
      });
      return {
        snapshot,
        races: valid.map((row) => ({
          manifest: {
            id: row.id,
            contestId: row.contestId,
            electionDate: row.electionDate,
            jurisdiction: row.jurisdiction,
            members: row.members,
          },
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
