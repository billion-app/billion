import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  candidateBriefSchema,
  candidateRaceManifestSchema,
} from "@acme/validators";

import {
  CatalogStatusCache,
  catalogStatusKey,
  validateCatalogStatuses,
} from "./california-catalog-status";
import { briefDigest } from "./candidate-brief-publication";
import { readCandidateRace } from "./candidate-race-release";

const now = Date.parse("2026-10-30T12:00:00Z");
function fixture(index: number) {
  const briefs = Array.from({ length: index < 68 ? 1 : 2 }, (_, member) =>
    candidateBriefSchema.parse({
      schemaVersion: 1,
      identity: {
        candidateId: `candidate-${index}-${member}`,
        contestId: `race-${index}`,
        jurisdiction: "fixture:ca",
        electionDate: "2026-11-03",
      },
      revisionId: randomUUID(),
      supersedes: null,
      createdAt: "2026-10-30T10:00:00Z",
      authorId: "author",
      authorship: { kind: "human" },
      correction: null,
      evidence: [],
      sections: [
        "priorities",
        "record",
        "mechanisms",
        "effects",
        "tradeoffs",
        "unknowns",
      ].map((topic) => ({
        topic,
        claims: [],
        missingEvidence: "Synthetic source gap. No promise is fabricated.",
      })),
    }),
  );
  const manifest = candidateRaceManifestSchema.parse({
    id: randomUUID(),
    contestId: `race-${index}`,
    jurisdiction: "fixture:ca",
    electionDate: "2026-11-03",
    jurisdictionLabel: "Fixture",
    office: "Fixture office",
    rosterSourceUrl: "https://example.org/roster",
    rosterHash: "a".repeat(64),
    rosterVerifiedAt: "2026-10-30T10:00:00Z",
    rosterVerifiedBy: "fixture",
    members: briefs.map((brief) => ({
      candidateId: brief.identity.candidateId,
      revisionId: brief.revisionId,
      name: brief.identity.candidateId,
      description: null,
      ballotStatus: "on_ballot",
    })),
    policyVersion: "fixture-policy",
    sourceCheckedAt: "2026-10-30T10:00:00Z",
    expiresAt: "2026-10-31T10:00:00Z",
    currentHashes: {},
  });
  return {
    manifest,
    revokedReason: null as string | null,
    revisions: briefs.map((brief) => ({
      id: brief.revisionId,
      revisionDigest: briefDigest(brief),
      document: brief,
    })),
    events: briefs.map((brief) => ({
      revisionId: brief.revisionId,
      actorId: "reviewer",
      action: "approve",
      policyVersion: manifest.policyVersion,
      createdAt: new Date("2026-10-30T11:00:00Z"),
    })),
    policy: { approved: true, version: manifest.policyVersion },
    now: new Date(now).toISOString(),
  };
}
function candidates(fixtures: ReturnType<typeof fixture>[]) {
  return fixtures
    .filter((value) => value.revokedReason === null)
    .map((value) => ({
      value,
      key: catalogStatusKey(value),
      expiresAt: Date.parse(value.manifest.expiresAt),
    }));
}
void test("twenty catalog pages validate 228 races and hydrate 388 briefs only on the cold page", async (t) => {
  const fixtures = Array.from({ length: 228 }, (_, index) => fixture(index));
  const cache = new CatalogStatusCache();
  let hydratedRevisions = 0,
    gateCalls = 0,
    hydratedBytes = 0,
    validationBatches = 0;
  for (let page = 0; page < 20; page++) {
    const statuses = await validateCatalogStatuses({
      candidates: candidates(fixtures),
      cache,
      now: now + page,
      validate: (missing) => {
        validationBatches++;
        return Promise.resolve(
          new Set(
            missing.filter((value) => {
              gateCalls++;
              hydratedRevisions += value.revisions.length;
              hydratedBytes += Buffer.byteLength(JSON.stringify(value));
              return readCandidateRace(value) !== null;
            }),
          ),
        );
      },
    });
    assert.equal(statuses.length, 228);
    if (page > 0) assert.equal(hydratedRevisions, 388);
  }
  assert.equal(validationBatches, 1);
  assert.equal(gateCalls, 228);
  assert.equal(hydratedRevisions, 388);
  t.diagnostic(
    JSON.stringify({
      catalogPages: 20,
      races: 228,
      candidates: 388,
      validationBatches,
      gateCalls,
      fullRevisionHydrations: hydratedRevisions,
      fullValidationInputBytes: hydratedBytes,
      repeatedFullValidationInputBytesAvoided: hydratedBytes * 19,
    }),
  );
});
void test("changed reviews, document, policy, roster and revocation cannot reuse approved status", async () => {
  const original = fixture(0);
  const cache = new CatalogStatusCache();
  const validate = (missing: ReturnType<typeof fixture>[]) =>
    Promise.resolve(
      new Set(missing.filter((value) => readCandidateRace(value) !== null)),
    );
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([original]),
        cache,
        now,
        validate,
      })
    ).length,
    1,
  );
  const rejected = structuredClone(original);
  const review = rejected.events[0];
  assert.ok(review);
  review.action = "reject";
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([rejected]),
        cache,
        now,
        validate,
      })
    ).length,
    0,
  );
  const changed = structuredClone(original);
  const revision = changed.revisions[0];
  assert.ok(revision);
  revision.document.authorId = "reviewer";
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([changed]),
        cache,
        now,
        validate,
      })
    ).length,
    0,
  );
  const policy = structuredClone(original);
  policy.policy.version = "new-policy";
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([policy]),
        cache,
        now,
        validate,
      })
    ).length,
    0,
  );
  const automation = {
    ...original,
    policy: {
      ...original.policy,
      automation: { invalid: "changed under same policy version" },
    },
  };
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([automation]),
        cache,
        now,
        validate,
      })
    ).length,
    0,
  );
  const roster = structuredClone(original);
  roster.manifest.members = [];
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([roster]),
        cache,
        now,
        validate,
      })
    ).length,
    0,
  );
  assert.equal(
    (
      await validateCatalogStatuses({
        candidates: candidates([
          { ...original, revokedReason: "source failure" },
        ]),
        cache,
        now,
        validate,
      })
    ).length,
    0,
  );
});
void test("expiry and backwards clock movement never retain a prior valid status", async () => {
  const value = fixture(0);
  const cache = new CatalogStatusCache();
  let calls = 0;
  const validate = (missing: ReturnType<typeof fixture>[]) => {
    calls++;
    return Promise.resolve(
      new Set(
        missing.filter(
          (value) =>
            readCandidateRace({
              ...value,
              now: new Date(now).toISOString(),
            }) !== null,
        ),
      ),
    );
  };
  const input = { candidates: candidates([value]), cache, now, validate };
  assert.equal((await validateCatalogStatuses(input)).length, 1);
  assert.equal(
    (
      await validateCatalogStatuses({
        ...input,
        now: Date.parse(value.manifest.expiresAt),
      })
    ).length,
    0,
  );
  assert.equal(calls, 1);
  const key = catalogStatusKey(value);
  cache.remember(key, now + 1000, now);
  assert.equal(cache.has(key, now - 1), false);
});
void test("positive status cache remains bounded", () => {
  const cache = new CatalogStatusCache(2);
  for (const key of ["a", "b", "c"]) cache.remember(key, now + 1000, now);
  assert.equal(cache.size, 2);
  assert.equal(cache.has("a", now), false);
  assert.equal(cache.has("c", now), true);
});

void test("cache eviction never truncates a validated catalog larger than capacity", async () => {
  const cache = new CatalogStatusCache(2);
  const values = Array.from({ length: 5 }, (_, index) => ({
    key: String(index),
    expiresAt: now + 1000,
    value: index,
  }));
  const result = await validateCatalogStatuses({
    candidates: values,
    cache,
    now,
    validate: (missing) => Promise.resolve(new Set(missing)),
  });
  assert.deepEqual(result, [0, 1, 2, 3, 4]);
  assert.equal(cache.size, 2);
});
