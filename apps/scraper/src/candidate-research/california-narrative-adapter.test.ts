import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";

import { decodeCaliforniaRoster } from "./california-roster.js";
import { createCaliforniaDependencies } from "./california.js";

test("policy adapter skips legacy pilot acquisition for narrative-only research", async (t) => {
  const requests: string[] = [];
  const unavailable = () =>
    Object.assign(new Error("Offline source unavailable"), {
      code: "ECONNRESET",
    });
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  for (const transport of [http, https])
    t.mock.method(transport, "request", (url: string) => {
      requests.push(String(url));
      throw unavailable();
    });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected unbounded HTTP request");
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const bytes = await readFile(
    new URL("./fixtures/C26GG.txt", import.meta.url),
  );
  const text = await readFile(
    new URL("./fixtures/certified-2026.txt", import.meta.url),
    "utf8",
  );
  const snapshot = decodeCaliforniaRoster({
    bytes,
    fetchedAt: "2026-10-30T12:00:00.000Z",
    certification: {
      id: "certification",
      url: "https://example.gov/certification",
      publisher: "California Secretary of State",
      format: "text",
      text,
      contentHash: createHash("sha256").update(text).digest("hex"),
      fetchedAt: "2026-10-30T12:00:00.000Z",
    },
  });
  const race = snapshot.races.find(
    (target) => target.raceKey === "ca-house-17-2026",
  );
  assert.ok(race);
  const member = race.members[0];
  assert.ok(member);
  const deps = await createCaliforniaDependencies({
    approved: true,
    version: "offline-adapter-test",
    automation: {},
    approvedBy: "offline test",
    statement: "Exercise source acquisition without persistence or models",
  });
  let discoveryAttempts = 0;
  let sourceRequests = 0;
  const budget = {
    request() {
      sourceRequests++;
      assert.ok(sourceRequests <= 30, "source acquisition stays bounded");
    },
    bytes() {},
    discovery() {
      discoveryAttempts++;
      throw new Error("Offline discovery unavailable");
    },
  };
  const dossier = await deps.investigate(
    { snapshot, race, member, researchScope: "narrative_only" },
    budget,
  );
  assert.equal(dossier.identity.candidateId, member.candidateId);
  assert.equal(dossier.classification, "evidence_gap");
  assert.equal(dossier.finance, null);
  assert.ok(dossier.evidence.some((entry) => entry.role === "roster"));
  assert.ok(discoveryAttempts > 0);
  assert.ok(requests.includes("https://www.house.gov/the-house-explained"));
  assert.equal(
    requests.some((url) => /fec\.gov|cert-list-candidates\.pdf/.test(url)),
    false,
  );
  assert.ok(
    dossier.gaps.some(
      (gap) =>
        gap.dimension === "finance" &&
        gap.code === "source_unavailable" &&
        !gap.required,
    ),
  );

  requests.length = 0;
  await assert.rejects(() =>
    deps.investigate({ snapshot, race, member }, budget),
  );
  assert.deepEqual(requests, [
    "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
  ]);
});
