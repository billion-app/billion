import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  ResearchSource,
} from "@acme/validators";

import {
  observedRosterSources,
  qualifyStateRosterObservation,
  rosterVerifiedAt,
} from "./california-roster-observation.js";
import { decodeCaliforniaRoster } from "./california-roster.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const bytes = readFileSync(new URL("./fixtures/C26GG.txt", import.meta.url));
const certificationText = readFileSync(
  new URL("./fixtures/certified-2026.txt", import.meta.url),
  "utf8",
);

function present<T>(value: T | undefined): T {
  assert(value !== undefined);
  return value;
}

function fixture() {
  const state = decodeCaliforniaRoster({
    bytes,
    fetchedAt: "2026-10-31T22:00:00.000Z",
    certification: {
      id: "certified",
      url: "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
      publisher: "California Secretary of State",
      format: "pdf",
      text: certificationText,
      contentHash: hash(certificationText),
      byteHash: hash("certification bytes"),
      fetchedAt: "2026-10-31T21:59:00.000Z",
    },
  });
  const local: CaliforniaRaceTarget = {
    ...present(state.races[0]),
    raceKey: "san-jose-council-2026",
    contestId: "scc:2026-11-03:local",
    officeFamily: "local",
  };
  const localProof: ResearchSource = {
    id: "territorial-proof",
    url: "https://geo.sanjoseca.gov/territory",
    publisher: "City of San José",
    format: "json",
    text: "reviewed local territory",
    contentHash: hash("reviewed local territory"),
    fetchedAt: "2026-10-28T12:00:00.000Z",
  };
  const previous: CaliforniaRosterSnapshot = {
    ...structuredClone(state),
    id: hash("reviewed composite identity"),
    scope: "ca_sos_certified_and_san_jose",
    scopeLabel: "State and San José candidates",
    races: [...structuredClone(state.races), local],
    additionalSources: [localProof],
    historicalSources: [{ ...localProof, id: "historical-territory" }],
    localCoverage: {
      scope: "san_jose",
      status: "pending",
      expectedCandidates: null,
      expectedRaces: null,
      pendingRaces: 1,
      pendingCandidates: 2,
      notes: "Reviewed local coverage remains pending",
    },
  };
  previous.source.fetchedAt = "2026-10-30T10:00:00.000Z";
  previous.certification.fetchedAt = "2026-10-30T10:00:00.000Z";
  const keys = [10, 16, 19].map(
    (district) => `ca-sos-2026-11-03-110000${district}0000`,
  );
  assert(keys.every((key) => state.races.some((race) => race.raceKey === key)));
  return { state, previous, keys, local, localProof };
}

void test("unchanged state authority renews only actual state observations in the composite", () => {
  const { state, previous, keys, localProof } = fixture();
  const original = structuredClone(previous);
  const observation = qualifyStateRosterObservation(previous, state, keys);
  assert(observation);
  assert.equal(observation.authority, "ca_sos_certified");
  assert.equal(observation.snapshot.id, previous.id);
  assert.deepEqual(observation.raceKeys, keys);
  assert.deepEqual(observation.snapshot, {
    ...previous,
    source: state.source,
    certification: state.certification,
  });
  assert.deepEqual(previous, original);
  assert.deepEqual(observation.snapshot.additionalSources, [localProof]);
  assert.equal(
    present(observation.snapshot.additionalSources[0]).fetchedAt,
    "2026-10-28T12:00:00.000Z",
  );
  const sources = observedRosterSources(observation);
  assert.deepEqual(
    sources.map((source) => source.url),
    [state.source.url, state.certification.url],
  );
  assert.equal(present(sources[0]).fetchedAt, state.source.fetchedAt);
  assert.equal(present(sources[1]).fetchedAt, state.certification.fetchedAt);
  const race = present(state.races.find((entry) => entry.raceKey === keys[0]));
  assert.equal(
    rosterVerifiedAt(observation, race),
    state.certification.fetchedAt,
  );
});

void test("local, mixed, empty and unknown selections cannot claim state-only observation", () => {
  const { previous, state, keys, local } = fixture();
  for (const selection of [
    [],
    [local.raceKey],
    [...keys, local.raceKey],
    ["absent-race"],
  ])
    assert.equal(
      qualifyStateRosterObservation(previous, state, selection),
      undefined,
    );
});

void test("authority or membership changes cannot preserve the old composite identity", () => {
  const mutate: ((snapshot: CaliforniaRosterSnapshot) => void)[] = [
    (snapshot) => (snapshot.electionDate = "2028-11-07"),
    (snapshot) => (snapshot.source.url = "https://other.gov/roster.txt"),
    (snapshot) => (snapshot.source.byteHash = hash("different bytes")),
    (snapshot) => (snapshot.source.text += "\n"),
    (snapshot) => (snapshot.source.textHash = hash("different text")),
    (snapshot) => (snapshot.certification.url = "https://other.gov/roster.pdf"),
    (snapshot) => (snapshot.certification.byteHash = hash("other PDF bytes")),
    (snapshot) => delete snapshot.certification.byteHash,
    (snapshot) => (snapshot.certification.text += "\n"),
    (snapshot) => (snapshot.certification.textHash = hash("other PDF text")),
    (snapshot) => snapshot.races.pop(),
    (snapshot) =>
      (present(present(snapshot.races[0]).members[0]).name =
        "Changed candidate"),
    (snapshot) =>
      (present(snapshot.races[0]).rosterDigest = hash("changed members")),
    (snapshot) =>
      (present(present(snapshot.races[0]).sourceProof).locator =
        "Changed proof context"),
    (snapshot) => snapshot.excludedContests.pop(),
    (snapshot) => (present(snapshot.countyCoverage[0]).name = "Changed county"),
  ];
  for (const change of mutate) {
    const { previous, state, keys } = fixture();
    change(state);
    assert.equal(
      qualifyStateRosterObservation(previous, state, keys),
      undefined,
    );
  }
});

void test("invalid stored hashes and changed existing membership also prevent state retention", () => {
  const { previous, state, keys } = fixture();
  previous.source.text += "changed archive";
  assert.equal(qualifyStateRosterObservation(previous, state, keys), undefined);
  const second = fixture();
  present(present(second.previous.races[0]).members[0]).partyCode = "changed";
  assert.equal(
    qualifyStateRosterObservation(second.previous, second.state, second.keys),
    undefined,
  );
});

void test("full observation retains conservative local freshness and local source set", () => {
  const { previous, local, localProof } = fixture();
  const observation = { authority: "composite" as const, snapshot: previous };
  assert.equal(observedRosterSources(observation).length, 3);
  assert.equal(observedRosterSources(observation)[2], localProof);
  assert.equal(rosterVerifiedAt(observation, local), localProof.fetchedAt);
  assert.equal(
    rosterVerifiedAt(observation, present(previous.races[0])),
    localProof.fetchedAt,
  );
});

void test("scoped observations cannot generate freshness for unobserved or altered races", () => {
  const { previous, state, keys, local } = fixture();
  const observation = present(
    qualifyStateRosterObservation(previous, state, keys),
  );
  assert.throws(() => rosterVerifiedAt(observation, local), /outside/);
  const unselected = present(
    state.races.find((race) => !keys.includes(race.raceKey)),
  );
  assert.throws(() => rosterVerifiedAt(observation, unselected), /outside/);
  const selected = present(
    state.races.find((race) => race.raceKey === keys[0]),
  );
  assert.throws(
    () =>
      rosterVerifiedAt(observation, { ...selected, rosterDigest: hash("x") }),
    /outside/,
  );
});
