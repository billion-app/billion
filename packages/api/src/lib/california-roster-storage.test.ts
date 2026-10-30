import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type {
  CaliforniaRosterSnapshot,
  ResearchSource,
} from "@acme/validators";
import { californiaRosterSnapshotSchema } from "@acme/validators";

import {
  encodeCaliforniaRosterStorage,
  hydrateCaliforniaRosterStorage,
} from "./california-roster-storage";

function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}
const hash = (text: string | Buffer) =>
  createHash("sha256").update(text).digest("hex");
const source = (text: string): ResearchSource => ({
  id: "authority",
  url: "https://example.gov/authority",
  publisher: "Official authority",
  format: "text",
  text,
  contentHash: hash(text),
  fetchedAt: "2026-10-30T20:14:48.836Z",
});
function snapshot(): CaliforniaRosterSnapshot {
  const id = hash("roster");
  return {
    schemaVersion: 1,
    id,
    electionDate: "2026-11-03",
    scope: "ca_sos_certified",
    scopeLabel: "Fixture",
    source: {
      url: "https://example.gov/roster",
      byteHash: id,
      textHash: id,
      fetchedAt: "2026-10-30T20:14:48.836Z",
      encoding: "windows-1252",
      text: "roster",
    },
    certification: {
      url: "https://example.gov/certification",
      textHash: id,
      fetchedAt: "2026-10-30T20:14:48.836Z",
      text: "certification",
    },
    races: [
      {
        raceKey: "fixture",
        contestId: "fixture",
        jurisdiction: "ca",
        jurisdictionLabel: "California",
        electionDate: "2026-11-03",
        sourceContestId: "1",
        officeFamily: "statewide",
        office: "Governor",
        district: null,
        kind: "election",
        rosterDigest: id,
        members: [
          {
            identity: {
              candidateId: "1",
              contestId: "fixture",
              jurisdiction: "ca",
              electionDate: "2026-11-03",
            },
            candidateId: "1",
            name: "Fixture Candidate",
            sourceCandidateId: "1",
            partyCode: "",
            party: null,
            ballotStatus: "on_ballot",
          },
        ],
      },
    ],
    additionalSources: [source("exact authority\r\nΩ")],
    excludedContests: [],
    countyCoverage: [],
  };
}
void test("archive references preserve original text, binary, metadata and occurrence order", async () => {
  const original = snapshot();
  const bytes = Buffer.from([0, 255, 34, 0, 10]);
  required(original.additionalSources).push({
    ...source(""),
    id: "map",
    format: "image",
    binaryBase64: bytes.toString("base64"),
    byteHash: hash(bytes),
  });
  const sealed = JSON.stringify(original);
  const encoded = encodeCaliforniaRosterStorage(original);
  assert.equal(encoded.archives.size, 2);
  assert.ok(
    required(encoded.document.additionalSources).every(
      (s) => "bodyArchiveKey" in s && !("text" in s) && !("binaryBase64" in s),
    ),
  );
  const requested: string[] = [];
  const restored = await hydrateCaliforniaRosterStorage(
    encoded.document,
    (key) => {
      requested.push(key);
      return Promise.resolve({
        kind: "roster_source_archive",
        document: encoded.archives.get(key),
      });
    },
  );
  assert.deepEqual(restored, original);
  assert.equal(
    JSON.stringify(restored),
    JSON.stringify(californiaRosterSnapshotSchema.parse(original)),
  );
  assert.equal(JSON.stringify(original), sealed);
  assert.equal(requested.length, 2);
});
void test("legacy inline documents remain readable without archive calls", async () => {
  const original = snapshot();
  assert.deepEqual(
    await hydrateCaliforniaRosterStorage(original, () => {
      throw new Error("Unexpected archive read");
    }),
    original,
  );
});
void test("missing, misclassified, corrupt and incorrectly addressed bodies fail closed", async () => {
  const encoded = encodeCaliforniaRosterStorage(snapshot());
  const [key, body] = required([...encoded.archives][0]);
  await assert.rejects(
    hydrateCaliforniaRosterStorage(encoded.document, () =>
      Promise.resolve(undefined),
    ),
    /Missing roster source archive/,
  );
  await assert.rejects(
    hydrateCaliforniaRosterStorage(encoded.document, () =>
      Promise.resolve({
        kind: "dossier",
        document: body,
      }),
    ),
    /Missing roster source archive/,
  );
  for (const corrupt of [
    { ...body, text: "replacement" },
    { ...body, contentHash: hash("replacement") },
    { ...body, format: "pdf" },
    { ...body, byteHash: hash("bytes") },
  ])
    await assert.rejects(
      hydrateCaliforniaRosterStorage(encoded.document, () =>
        Promise.resolve({
          kind: "roster_source_archive",
          document: corrupt,
        }),
      ),
      /identity mismatch/,
    );
  const wrong = structuredClone(encoded.document);
  Object.assign(required(required(wrong.additionalSources)[0]), {
    bodyArchiveKey: `roster-source:${hash("other")}`,
  });
  await assert.rejects(
    hydrateCaliforniaRosterStorage(wrong, (requested) => {
      assert.notEqual(requested, key);
      return Promise.resolve({ kind: "roster_source_archive", document: body });
    }),
    /identity mismatch/,
  );
});
void test("binary archives and unsupported codec versions fail closed", async () => {
  const original = snapshot();
  const bytes = Buffer.from("actual image");
  original.additionalSources = [
    {
      ...source(""),
      format: "image",
      binaryBase64: bytes.toString("base64"),
      byteHash: hash(bytes),
    },
  ];
  const encoded = encodeCaliforniaRosterStorage(original);
  const body = required([...encoded.archives.values()][0]);
  await assert.rejects(
    hydrateCaliforniaRosterStorage(encoded.document, () =>
      Promise.resolve({
        kind: "roster_source_archive",
        document: {
          ...body,
          binaryBase64: Buffer.from("different").toString("base64"),
        },
      }),
    ),
    /binary hash mismatch/,
  );
  await assert.rejects(
    hydrateCaliforniaRosterStorage(
      { ...encoded.document, storageVersion: "unknown" },
      () => Promise.resolve(undefined),
    ),
  );
});
void test("stored manifest and individual archive limits reject before persistence", () => {
  const original = snapshot();
  original.historicalSources = [source("x".repeat(4 * 1024 * 1024))];
  assert.throws(
    () => encodeCaliforniaRosterStorage(original),
    /stored manifest exceeds/,
  );
  original.historicalSources = [];
  original.additionalSources = [source('"'.repeat(3_500_000))];
  assert.throws(
    () => encodeCaliforniaRosterStorage(original),
    /source archive exceeds/,
  );
});

void test("reviewed occurrences preserve independent metadata and original bodies", async () => {
  const original = snapshot();
  const current = required(required(original.additionalSources)[0]);
  const baseline = source("independently reviewed original authority");
  original.localPrimary = {
    kind: "scc_clarity",
    definitionURL: "https://example.gov/definition",
    settingsURL: "https://example.gov/settings",
    currentVersionURL: "https://example.gov/version",
    identityCrosswalk: {
      schemaVersion: 1,
      electionDate: "2026-11-03",
      definitionHash: hash("definition"),
      members: [
        {
          sourceContestId: "1",
          sourceOrdinal: "1",
          clarityContestKey: "contest",
          clarityChoiceIndex: 0,
          name: "Fixture Candidate",
          status: "on_ballot",
        },
      ],
      review: {
        digest: hash("review"),
        actorId: "fixture-unattested",
        reviewedAt: current.fetchedAt,
      },
    },
    reviewedSources: [
      baseline,
      {
        ...current,
        id: "reviewed-authority",
        fetchedAt: "2026-10-29T20:14:48.836Z",
      },
      baseline,
    ],
  };
  original.historicalSources = [source("historical official contact")];
  const encoded = encodeCaliforniaRosterStorage(original);
  assert.equal(encoded.archives.size, 1);
  assert.ok(
    "text" in
      required(
        required(required(encoded.document.localPrimary).reviewedSources)[0],
      ),
  );
  assert.ok(
    "bodyArchiveKey" in
      required(
        required(required(encoded.document.localPrimary).reviewedSources)[1],
      ),
  );
  assert.deepEqual(
    encoded.document.historicalSources,
    original.historicalSources,
  );
  const reads: string[] = [];
  const hydrated = await hydrateCaliforniaRosterStorage(
    encoded.document,
    (key) => {
      reads.push(key);
      return Promise.resolve({
        kind: "roster_source_archive",
        document: encoded.archives.get(key),
      });
    },
  );
  assert.deepEqual(hydrated, original);
  assert.equal(reads.length, 1);
});

void test("mixed reference and inline bodies cannot bypass archive verification", async () => {
  const encoded = encodeCaliforniaRosterStorage(snapshot());
  const mixed = structuredClone(encoded.document);
  const selected = required(required(mixed.additionalSources)[0]);
  Object.assign(selected, {
    text: "tampered inline text",
    binaryBase64: Buffer.from("tampered").toString("base64"),
  });
  let reads = 0;
  await assert.rejects(
    hydrateCaliforniaRosterStorage(mixed, () => {
      reads++;
      return Promise.resolve(undefined);
    }),
  );
  assert.equal(reads, 0);
});
