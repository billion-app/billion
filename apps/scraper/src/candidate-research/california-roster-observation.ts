import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  ResearchSource,
} from "@acme/validators";

export type CaliforniaRosterObservation =
  | {
      authority: "ca_sos_certified";
      snapshot: CaliforniaRosterSnapshot;
      raceKeys: readonly string[];
    }
  | {
      authority: "composite";
      snapshot: CaliforniaRosterSnapshot;
    };

const textHash = (text: string) =>
  createHash("sha256").update(text).digest("hex");

function stateAuthority(snapshot: CaliforniaRosterSnapshot) {
  const { fetchedAt: _sourceFetchedAt, ...source } = snapshot.source;
  const { fetchedAt: _certificationFetchedAt, ...certification } =
    snapshot.certification;
  return {
    electionDate: snapshot.electionDate,
    source,
    certification,
    races: snapshot.races.filter((race) => race.officeFamily !== "local"),
    excludedContests: snapshot.excludedContests,
    countyCoverage: snapshot.countyCoverage,
  };
}

export function stateRosterAuthorityUnchanged(
  previous: CaliforniaRosterSnapshot,
  fresh: CaliforniaRosterSnapshot,
): boolean {
  return (
    [previous, fresh].every(
      (snapshot) =>
        textHash(snapshot.source.text) === snapshot.source.textHash &&
        textHash(snapshot.certification.text) ===
          snapshot.certification.textHash,
    ) && isDeepStrictEqual(stateAuthority(previous), stateAuthority(fresh))
  );
}

export function qualifyStateRosterObservation(
  previous: CaliforniaRosterSnapshot,
  freshState: CaliforniaRosterSnapshot,
  selectedRaceKeys: readonly string[],
):
  | Extract<CaliforniaRosterObservation, { authority: "ca_sos_certified" }>
  | undefined {
  if (
    previous.scope !== "ca_sos_certified_and_san_jose" ||
    freshState.scope !== "ca_sos_certified" ||
    !selectedRaceKeys.length ||
    freshState.races.some((race) => race.officeFamily === "local") ||
    !selectedRaceKeys.every((key) =>
      freshState.races.some((race) => race.raceKey === key),
    ) ||
    !stateRosterAuthorityUnchanged(previous, freshState)
  )
    return undefined;
  return {
    authority: "ca_sos_certified",
    snapshot: {
      ...previous,
      source: freshState.source,
      certification: freshState.certification,
    },
    raceKeys: [...new Set(selectedRaceKeys)],
  };
}

export function observedRosterSources(
  observation: CaliforniaRosterObservation,
): ResearchSource[] {
  const { snapshot } = observation;
  return [
    {
      id: "official-roster",
      url: snapshot.source.url,
      publisher: "California Secretary of State",
      format: "text",
      text: snapshot.source.text,
      contentHash: snapshot.source.textHash,
      byteHash: snapshot.source.byteHash,
      fetchedAt: snapshot.source.fetchedAt,
    },
    {
      id: "certified-roster",
      url: snapshot.certification.url,
      publisher: "California Secretary of State",
      format: "pdf",
      text: snapshot.certification.text,
      contentHash: snapshot.certification.textHash,
      byteHash: snapshot.certification.byteHash,
      fetchedAt: snapshot.certification.fetchedAt,
    },
    ...(observation.authority === "composite"
      ? (snapshot.additionalSources ?? [])
      : []),
  ];
}

export function rosterVerifiedAt(
  observation: CaliforniaRosterObservation,
  race: CaliforniaRaceTarget,
): string {
  if (
    !observation.snapshot.races.some((member) =>
      isDeepStrictEqual(member, race),
    ) ||
    (observation.authority === "ca_sos_certified" &&
      (race.officeFamily === "local" ||
        !observation.raceKeys.includes(race.raceKey)))
  )
    throw new Error("Race is outside the observed roster authority");
  return new Date(
    Math.min(
      ...observedRosterSources(observation).map((source) =>
        Date.parse(source.fetchedAt),
      ),
    ),
  ).toISOString();
}
