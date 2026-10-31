import { z } from "zod/v4";

import type { db } from "@acme/db/client";
import { and, eq, gt, sql } from "@acme/db";
import { CivicApiCache } from "@acme/db/schema";

import type { PublicCaliforniaRoster } from "./california-public-roster";
import type { VoterInfoResponse } from "./civic";

export const BALLOT_RESEARCH_DEMAND_ENDPOINT = "ballot-research-demand:v1";
const addressHash = "__ballot_research_demand__";
const lifetime = 24 * 60 * 60 * 1000;
const electionCutoff = (date: string) =>
  Date.parse(`${date}T23:59:59.999-08:00`) + 1;
const demandSchema = z.object({
  kind: z.literal("provider_verified"),
  provider: z.literal("democracy_works"),
  electionId: z.string().min(1),
  electionDate: z.iso.date(),
  contestId: z.string().min(1),
  jurisdiction: z.string().min(1),
  district: z.string().min(1),
  office: z.string().min(1),
  candidates: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        status: z.enum(["onBallot", "withdrewStillOnBallot"]),
      }),
    )
    .min(1),
  observedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type BallotResearchDemand = z.infer<typeof demandSchema>;
const operatorDemandSchema = z.object({
  kind: z.literal("operator_requested"),
  electionDate: z.iso.date(),
  contestId: z.string().min(1),
  jurisdiction: z.string().min(1),
  raceKey: z.string().min(1),
  reason: z.string().trim().min(10).max(1000),
  observedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
type ResearchDemand =
  | BallotResearchDemand
  | z.infer<typeof operatorDemandSchema>;
type Roster = Pick<PublicCaliforniaRoster, "electionDate" | "races">;
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
function districtNumber(value: string) {
  return /^(?:(?:california )?(?:(?:congressional|state senate|state assembly|assembly|senate|board of equalization) )?district )?(\d+)$/i.exec(
    normalize(value),
  )?.[1];
}
function sameOffice(race: Roster["races"][number], office: string) {
  if (normalize(race.office) === normalize(office)) return true;
  return (
    race.officeFamily === "us_house" &&
    /^(?:(?:united states|u\.?s\.?) (?:house(?: of representatives)?|representative)|representative in congress)(?: district \d+)?$/i.test(
      normalize(office),
    )
  );
}

export function ballotResearchDemand(
  ballot: VoterInfoResponse,
  now: Date,
): BallotResearchDemand[] {
  const provider = ballot.provider;
  if (
    provider?.name !== "democracy_works" ||
    provider.addressScope !== "address" ||
    provider.ballotDataStatus !== "provided"
  )
    return [];
  const fetched = Date.parse(provider.fetchedAt);
  const expiry = Math.min(
    fetched + lifetime,
    electionCutoff(ballot.election.electionDay),
  );
  if (
    !Number.isFinite(fetched) ||
    fetched > now.getTime() ||
    !Number.isFinite(expiry) ||
    expiry <= now.getTime()
  )
    return [];
  return (ballot.contests ?? []).flatMap((contest) => {
    if (
      contest.type !== "candidate" ||
      contest.providerIdentity?.provider !== "democracy_works"
    )
      return [];
    const value = demandSchema.safeParse({
      kind: "provider_verified",
      provider: provider.name,
      electionId: ballot.election.id,
      electionDate: ballot.election.electionDay,
      contestId: contest.providerIdentity.contestId,
      jurisdiction: contest.district?.id,
      district: contest.district?.name,
      office: contest.office,
      candidates: contest.candidates?.map((candidate) => ({
        id:
          candidate.providerIdentity?.provider === "democracy_works"
            ? candidate.providerIdentity.candidateId
            : undefined,
        name: candidate.name,
        status: candidate.ballotStatus,
      })),
      observedAt: provider.fetchedAt,
      expiresAt: new Date(expiry).toISOString(),
    });
    return value.success ? [value.data] : [];
  });
}

export function demandedRosterRaceKeys(
  snapshot: Roster,
  demands: readonly ResearchDemand[],
  now: Date,
): string[] {
  const keys = new Set<string>();
  for (const demand of demands) {
    if (
      demand.electionDate !== snapshot.electionDate ||
      Date.parse(demand.expiresAt) <= now.getTime() ||
      Date.parse(demand.observedAt) > now.getTime()
    )
      continue;
    if (demand.kind === "operator_requested") {
      const target = snapshot.races.find(
        (race) =>
          race.raceKey === demand.raceKey &&
          race.contestId === demand.contestId &&
          race.jurisdiction === demand.jurisdiction,
      );
      if (target) keys.add(target.raceKey);
      continue;
    }
    const targets = snapshot.races.filter(
      (race) =>
        race.jurisdiction === demand.jurisdiction &&
        sameOffice(race, demand.office) &&
        (!race.district ||
          normalize(race.district) === normalize(demand.district) ||
          (districtNumber(race.district) !== undefined &&
            districtNumber(race.district) ===
              districtNumber(demand.district))) &&
        new Set(demand.candidates.map((candidate) => normalize(candidate.name)))
          .size === demand.candidates.length &&
        demand.candidates.every(
          (candidate) =>
            race.members.filter(
              (member) => normalize(member.name) === normalize(candidate.name),
            ).length === 1,
        ) &&
        race.members
          .filter((member) => member.ballotStatus !== "qualified_write_in")
          .every((member) =>
            demand.candidates.some(
              (candidate) =>
                normalize(candidate.name) === normalize(member.name),
            ),
          ),
    );
    const [target] = targets;
    if (target && targets.length === 1) keys.add(target.raceKey);
  }
  return [...keys].sort();
}

type Writer = Pick<typeof db, "insert">;
type Reader = Pick<typeof db, "select">;
export async function recordBallotResearchDemand(
  database: Writer,
  ballot: VoterInfoResponse,
  now = new Date(),
) {
  for (const demand of ballotResearchDemand(ballot, now)) {
    const params = JSON.stringify([
      demand.electionId,
      demand.contestId,
      demand.jurisdiction,
    ]);
    await database
      .insert(CivicApiCache)
      .values({
        addressHash,
        endpoint: BALLOT_RESEARCH_DEMAND_ENDPOINT,
        params,
        responseData: demand,
        fetchedAt: new Date(demand.observedAt),
        expiresAt: new Date(demand.expiresAt),
      })
      .onConflictDoUpdate({
        target: [
          CivicApiCache.addressHash,
          CivicApiCache.endpoint,
          CivicApiCache.params,
        ],
        set: {
          responseData: demand,
          fetchedAt: new Date(demand.observedAt),
          expiresAt: new Date(demand.expiresAt),
        },
        setWhere: sql`${CivicApiCache.fetchedAt} <= ${new Date(demand.observedAt)}`,
      });
  }
}

export async function requestOperatorResearch(
  database: Writer,
  snapshot: Roster,
  raceKeys: readonly string[],
  reason: string,
  now = new Date(),
) {
  if (
    !raceKeys.length ||
    raceKeys.some((key) => !snapshot.races.some((race) => race.raceKey === key))
  )
    throw new Error("Explicit authoritative race keys are required");
  const demands = snapshot.races
    .filter((race) => raceKeys.includes(race.raceKey))
    .map((race) =>
      operatorDemandSchema.parse({
        kind: "operator_requested",
        electionDate: snapshot.electionDate,
        contestId: race.contestId,
        jurisdiction: race.jurisdiction,
        raceKey: race.raceKey,
        reason,
        observedAt: now.toISOString(),
        expiresAt: new Date(
          electionCutoff(snapshot.electionDate),
        ).toISOString(),
      }),
    );
  if (demands.some((demand) => Date.parse(demand.expiresAt) <= now.getTime()))
    throw new Error("Research requests must precede the election cutoff");
  for (const demand of demands) {
    const params = JSON.stringify([
      demand.kind,
      demand.electionDate,
      demand.contestId,
      demand.jurisdiction,
    ]);
    await database
      .insert(CivicApiCache)
      .values({
        addressHash,
        endpoint: BALLOT_RESEARCH_DEMAND_ENDPOINT,
        params,
        responseData: demand,
        fetchedAt: now,
        expiresAt: new Date(demand.expiresAt),
      })
      .onConflictDoUpdate({
        target: [
          CivicApiCache.addressHash,
          CivicApiCache.endpoint,
          CivicApiCache.params,
        ],
        set: {
          responseData: demand,
          fetchedAt: now,
          expiresAt: new Date(demand.expiresAt),
        },
        setWhere: sql`${CivicApiCache.fetchedAt} <= ${now}`,
      });
  }
  return demands;
}

export async function readDemandedRosterRaceKeys(
  database: Reader,
  snapshot: Roster,
  now = new Date(),
) {
  const rows = await database
    .select({ value: CivicApiCache.responseData })
    .from(CivicApiCache)
    .where(
      and(
        eq(CivicApiCache.addressHash, addressHash),
        eq(CivicApiCache.endpoint, BALLOT_RESEARCH_DEMAND_ENDPOINT),
        gt(CivicApiCache.expiresAt, now),
      ),
    );
  return demandedRosterRaceKeys(
    snapshot,
    rows.flatMap(({ value }) => {
      const parsed = z
        .discriminatedUnion("kind", [demandSchema, operatorDemandSchema])
        .safeParse(value);
      return parsed.success ? [parsed.data] : [];
    }),
    now,
  );
}
