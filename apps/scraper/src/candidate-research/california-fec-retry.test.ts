import assert from "node:assert/strict";
import test from "node:test";

import type { CaliforniaFecRetryFact } from "./california-fec-retry.js";
import {
  californiaFecRetryDeferReason,
  mergeCaliforniaFecRetry,
  readCaliforniaFecRetry,
} from "./california-fec-retry.js";

const now = "2026-11-02T02:00:00.000Z";
const ca16 = {
  attemptedAt: "2026-11-02T01:25:47.641Z",
  reason:
    "Source request failed (429); source https://api.open.fec.gov/v1/reports/house-senate/; retry after 17281 seconds",
};
const ca19 = {
  attemptedAt: "2026-11-02T01:25:50.091Z",
  reason:
    "Source request failed (429); source https://api.open.fec.gov/v1/schedules/schedule_e/by_candidate/; retry after 9525 seconds",
};
const expected: CaliforniaFecRetryFact = {
  resource: "https://api.open.fec.gov/v1/reports/house-senate/",
  attemptedAt: ca16.attemptedAt,
  retryAfterSeconds: 17281,
  notBefore: "2026-11-02T06:13:48.641Z",
};

test("captured CA16 and CA19 checkpoints retain the shared maximum and one safety margin", () => {
  const state = mergeCaliforniaFecRetry(
    readCaliforniaFecRetry(ca16, now),
    readCaliforniaFecRetry(ca19, now),
  );
  assert.deepEqual(state, expected);
  assert.match(
    californiaFecRetryDeferReason(state, "2026-11-02T06:14:48.640Z")!,
    /Previously observed.*2026-11-02T06:14:48.641Z/,
  );
  assert.equal(
    californiaFecRetryDeferReason(state, "2026-11-02T06:14:48.641Z"),
    undefined,
  );
  assert.equal(
    californiaFecRetryDeferReason(state, "2026-11-02T06:14:48.642Z"),
    undefined,
  );
});

test("persisted longest fact survives shorter observations and unrelated failures without renewal", () => {
  const retained = readCaliforniaFecRetry({ ...ca19, fecRetry: expected }, now);
  assert.deepEqual(retained, expected);
  const later = readCaliforniaFecRetry(
    {
      fecRetry: retained,
      attemptedAt: "2026-11-02T08:00:00.000Z",
      reason: "Campaign source changed",
    },
    "2026-11-02T08:00:00.000Z",
  );
  assert.deepEqual(later, expected);
  assert.equal(
    californiaFecRetryDeferReason(later, "2026-11-02T08:00:00.000Z"),
    undefined,
  );
});

test("new longer observation keeps its actual resource and timestamp", () => {
  const later = {
    attemptedAt: "2026-11-02T01:40:00.000Z",
    reason:
      "Source request failed (429); source https://api.open.fec.gov/v1/candidate/H8CA00001/committees/; retry after 86400 seconds",
  };
  const observed = readCaliforniaFecRetry(later, now);
  assert.deepEqual(mergeCaliforniaFecRetry(expected, observed), {
    resource: "https://api.open.fec.gov/v1/candidate/H8CA00001/committees/",
    attemptedAt: later.attemptedAt,
    retryAfterSeconds: 86400,
    notBefore: "2026-11-03T01:40:00.000Z",
  });
});

test("known FEC 429 with unusable metadata defers without inventing a deadline", () => {
  for (const checkpoint of [
    { ...ca16, attemptedAt: undefined },
    { ...ca16, attemptedAt: "yesterday" },
    { ...ca16, attemptedAt: "2026-11-03T01:00:00.000Z" },
    { ...ca16, attemptedAt: "+275760-09-13T00:00:00.000Z" },
    { ...ca16, attemptedAt: "2026-11-02T01:25:47Z" },
    {
      ...ca16,
      reason:
        "Source request failed (429); source https://api.open.fec.gov/v1/reports/house-senate/",
    },
    ...["-1", "1.5", "01", "86401", "9".repeat(400)].map((retry) => ({
      ...ca16,
      reason: ca16.reason.replace("17281", retry),
    })),
    ...[
      "http://api.open.fec.gov/v1/reports/house-senate/",
      "https://API.OPEN.FEC.GOV/v1/reports/house-senate/",
      "https://api.open.fec.gov:443/v1/reports/house-senate/",
      "https://user:secret@api.open.fec.gov/v1/reports/house-senate/",
      "https://api.open.fec.gov/v1/reports/house-senate/?api_key=secret",
      "https://api.open.fec.gov/v1/reports/house-senate/#fragment",
      "https://api.open.fec.gov/v1/../reports/house-senate/",
      "https://api.open.fec.gov/reports/house-senate/",
    ].map((resource) => ({
      ...ca16,
      reason: `Source request failed (429); source ${resource}; retry after 17281 seconds`,
    })),
  ]) {
    const state = readCaliforniaFecRetry(checkpoint, now);
    assert.ok(state && "invalid" in state);
    assert.equal("notBefore" in state, false);
    assert.match(
      californiaFecRetryDeferReason(state, now)!,
      /metadata is invalid/,
    );
    assert.doesNotMatch(
      californiaFecRetryDeferReason(state, now)!,
      /failed \(429\)/,
    );
  }
});

test("invalid retained metadata stays fail closed through later checkpoints and keeps genuine maximum", () => {
  const malformed = readCaliforniaFecRetry({ ...ca16, attemptedAt: null }, now);
  const merged = mergeCaliforniaFecRetry(expected, malformed);
  assert.ok(merged && "invalid" in merged);
  assert.deepEqual(merged.observed, expected);
  const restarted = readCaliforniaFecRetry(
    {
      fecRetry: merged,
      reason: "An unrelated campaign outage",
      attemptedAt: now,
    },
    now,
  );
  assert.deepEqual(restarted, merged);
  const shorter = readCaliforniaFecRetry(ca19, now);
  assert.deepEqual(mergeCaliforniaFecRetry(restarted, shorter), merged);
  assert.deepEqual(mergeCaliforniaFecRetry(shorter, restarted), merged);
  assert.match(
    californiaFecRetryDeferReason(restarted, "2026-11-04T00:00:00.000Z")!,
    /metadata is invalid/,
  );
});

test("persisted facts are validated rather than trusted as retry permission", () => {
  for (const saved of [
    null,
    {},
    { ...expected, notBefore: "2026-11-02T06:14:48.641Z" },
    { ...expected, retryAfterSeconds: 17280 },
    { ...expected, attemptedAt: "2026-11-04T00:00:00.000Z" },
    { ...expected, resource: "https://www.fec.gov/v1/reports/house-senate/" },
  ]) {
    const state = readCaliforniaFecRetry({ fecRetry: saved }, now);
    assert.ok(state && "invalid" in state);
  }
});

test("non-FEC failures do not create a retry fact or defer research", () => {
  for (const checkpoint of [
    null,
    {},
    { reason: "Source request failed (429)", attemptedAt: now },
    { ...ca16, reason: ca16.reason.replace("(429)", "(503)") },
    { ...ca16, reason: ca16.reason.replace("api.open.fec.gov", "www.fec.gov") },
    {
      ...ca16,
      reason: ca16.reason.replace(
        "api.open.fec.gov",
        "api.open.fec.gov.example.org",
      ),
    },
    { reason: "Model provider quota exhausted", attemptedAt: now },
  ]) {
    const state = readCaliforniaFecRetry(checkpoint, now);
    assert.equal(state, undefined);
    assert.equal(californiaFecRetryDeferReason(state, now), undefined);
  }
});

test("Retry-After zero still receives exactly the fixed safety interval", () => {
  const state = readCaliforniaFecRetry(
    { ...ca16, reason: ca16.reason.replace("17281", "0") },
    now,
  );
  assert.match(
    californiaFecRetryDeferReason(state, "2026-11-02T01:26:47.640Z")!,
    /2026-11-02T01:26:47.641Z/,
  );
  assert.equal(
    californiaFecRetryDeferReason(state, "2026-11-02T01:26:47.641Z"),
    undefined,
  );
});
