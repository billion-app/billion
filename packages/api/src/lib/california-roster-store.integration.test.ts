import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { CaliforniaRosterSnapshot } from "@acme/validators";
import { eq } from "@acme/db";
import {
  CaliforniaRaceWork,
  CaliforniaResearchArtifact,
  CaliforniaRoster,
} from "@acme/db/schema";

import {
  claimCaliforniaRaceWork,
  getCaliforniaResearchArtifact,
  getLatestCaliforniaRoster,
  saveCaliforniaRaceCheckpoint,
  saveCaliforniaResearchArtifact,
  saveCaliforniaRoster,
} from "./california-roster-store";

const url = process.env.CANDIDATE_RESEARCH_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) ||
    !parsed.pathname.endsWith("_test")
  )
    throw new Error(
      "California store integration requires a local _test database",
    );
  process.env.POSTGRES_URL = url;
}
void test(
  "immutable exact-input artifacts and lease generations survive retry",
  { skip: !url },
  async () => {
    const { db } = await import("@acme/db/client");
    const id = randomUUID().replaceAll("-", "").padEnd(64, "0");
    const key = `test-${randomUUID()}`;
    const timestamp = "2026-10-30T00:00:00.000Z";
    const snapshot: CaliforniaRosterSnapshot = {
      schemaVersion: 1,
      id,
      electionDate: "2026-11-03",
      scope: "ca_sos_certified",
      scopeLabel: "fixture",
      source: {
        url: "https://example.gov/roster",
        byteHash: id,
        textHash: id,
        fetchedAt: timestamp,
        encoding: "windows-1252",
        text: "fixture",
      },
      certification: {
        url: "https://example.gov/certified",
        textHash: id,
        fetchedAt: timestamp,
        text: "fixture",
      },
      races: [
        {
          raceKey: key,
          contestId: key,
          jurisdiction: "ca",
          jurisdictionLabel: "California",
          electionDate: "2026-11-03",
          sourceContestId: "02",
          officeFamily: "statewide",
          office: "Governor",
          district: null,
          kind: "election",
          rosterDigest: id,
          members: [
            {
              identity: {
                candidateId: key,
                contestId: key,
                jurisdiction: "ca",
                electionDate: "2026-11-03",
              },
              candidateId: key,
              name: "Fixture",
              sourceCandidateId: "1",
              partyCode: "",
              party: null,
              ballotStatus: "on_ballot",
            },
          ],
        },
      ],
      excludedContests: [],
      countyCoverage: [],
    };
    try {
      await saveCaliforniaRoster(db, snapshot);
      assert.equal(
        (await saveCaliforniaRoster(db, { ...snapshot, scopeLabel: "changed" }))
          .scopeLabel,
        "fixture",
      );
      assert.equal((await getLatestCaliforniaRoster(db, "2026-11-03"))?.id, id);
      const artifact = {
        key,
        kind: "dossier",
        raceKey: key,
        document: { result: "actual-output" },
      };
      await saveCaliforniaResearchArtifact(db, artifact);
      await saveCaliforniaResearchArtifact(db, {
        ...artifact,
        document: { result: "overwritten" },
      });
      assert.deepEqual(await getCaliforniaResearchArtifact(db, key), {
        result: "actual-output",
      });
      const base = {
        snapshotId: id,
        raceKey: key,
        rosterDigest: id,
        policyVersion: "fixture",
        researchVersion: "v1",
        owner: "first",
        now: new Date(timestamp),
        leaseMs: 1000,
      };
      const claims = await Promise.all([
        claimCaliforniaRaceWork(db, base),
        claimCaliforniaRaceWork(db, { ...base, owner: "second" }),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const first = claims.find(Boolean);
      assert(first);
      assert.equal(
        await claimCaliforniaRaceWork(db, {
          ...base,
          owner: "crash-retry",
          now: new Date(Date.parse(timestamp) + 500),
        }),
        null,
      );
      const resumed = await claimCaliforniaRaceWork(db, {
        ...base,
        owner: "resumed",
        now: new Date(Date.parse(timestamp) + 1001),
      });
      assert(resumed);
      assert.equal(resumed.generation, first.generation + 1);
      assert.equal(
        await saveCaliforniaRaceCheckpoint(db, {
          key: first.key,
          owner: first.owner,
          generation: first.generation,
          status: "complete",
          checkpoint: { stale: true },
          now: new Date(Date.parse(timestamp) + 1100),
        }),
        false,
      );
      assert.equal(
        await saveCaliforniaRaceCheckpoint(db, {
          key: resumed.key,
          owner: "resumed",
          generation: resumed.generation,
          status: "pending",
          checkpoint: { artifactKey: key },
          now: new Date(Date.parse(timestamp) + 1100),
        }),
        true,
      );
      const after = await claimCaliforniaRaceWork(db, {
        ...base,
        owner: "next",
        now: new Date(Date.parse(timestamp) + 1200),
      });
      assert.deepEqual(after?.checkpoint, { artifactKey: key });
    } finally {
      await db
        .delete(CaliforniaRaceWork)
        .where(eq(CaliforniaRaceWork.snapshotId, id));
      await db
        .delete(CaliforniaResearchArtifact)
        .where(eq(CaliforniaResearchArtifact.key, key));
      await db.delete(CaliforniaRoster).where(eq(CaliforniaRoster.id, id));
    }
  },
);
