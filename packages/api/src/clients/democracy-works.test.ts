import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BallotProviderError,
  createDemocracyWorksClient,
} from "./democracy-works";

// Synthetic fixtures follow the official v2 schema; they are not live ballots.
const race = {
  id: "contest-test",
  name: "Test council",
  level: "local",
  districtName: "Test district",
  ocdId: "ocd-division/country:us/state:ca/place:test",
  seatsUpForElection: "1",
  candidates: [
    "onBallot",
    "withdrewStillOnBallot",
    "declared",
    "disqualified",
    "withdrew",
    "unknown",
    undefined,
  ].map((status, i) => ({
    id: `person-${i}`,
    fullName: `Synthetic person ${i}`,
    partyAffiliation: ["Test party"],
    status,
    ballotpediaUrl: "https://ballotpedia.org/Synthetic_fixture",
    contact: { campaign: { website: "https://example.org" } },
  })),
};
const election = {
  ocdId: "ocd-division/country:us/state:ca",
  date: "2026-11-03",
  description: "Synthetic general election",
  type: "state",
  canonicalUrl: "https://voting.democracy.works/en/elections/fixture.html",
  website: "https://example.org/election",
  pollingLocationUrl: "https://example.org/locations",
  contests: [race],
  ballotMeasures: [
    {
      id: "measure-test",
      name: "Synthetic Measure A",
      shortName: "Measure A",
      districtName: "Test district",
      ocdId: "ocd-division/country:us/state:ca",
      summary: "Synthetic summary",
      ballotQuestion: "<p>Synthetic question</p>",
    },
  ],
};
function page(records: unknown[], extra: Record<string, unknown> = {}) {
  return {
    data: { elections: records, statewideOnly: false, ...extra },
    pagination: {
      totalRecordCount: records.length,
      currentPage: 1,
      pageSize: 100,
    },
  };
}
function client(payload: unknown) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const api = createDemocracyWorksClient({
    apiKey: () => "synthetic-key",
    now: () => new Date("2026-09-15T12:00:00Z"),
    fetch: (url, init) => {
      calls.push({
        url: new URL(url instanceof Request ? url.url : url),
        init,
      });
      return Promise.resolve(Response.json(payload));
    },
  });
  return { api, calls };
}
void test("DW address lookup maps cited candidates/measures without inventing normalization or logistics", async () => {
  const { api, calls } = client(page([election]));
  const result = await api.getVoterInfo("synthetic input");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url.origin, "https://api.democracy.works");
  assert.equal(calls[0].url.searchParams.get("includeBallotData"), "true");
  assert.equal(calls[0].url.searchParams.get("address"), "synthetic input");
  assert.equal(calls[0].url.searchParams.has("key"), false);
  assert.equal(
    new Headers(calls[0].init?.headers).get("x-api-key"),
    "synthetic-key",
  );
  assert.deepEqual(
    result.contests?.[0]?.candidates?.map((c) => c.ballotStatus),
    ["onBallot", "withdrewStillOnBallot"],
  );
  assert.equal(result.contests[1]?.referendumText, "Synthetic question");
  assert.equal(result.contests[0].sources?.[0]?.official, false);
  assert.equal(
    result.contests[0].candidates[0]?.citations?.[0]?.sourceName,
    "Democracy Works / Ballotpedia",
  );
  assert.equal(result.provider?.coverage, "partial");
  assert.equal(result.provider.addressScope, "address");
  assert.equal(result.submittedAddress, "synthetic input");
  assert.deepEqual(result.normalizedInput, {
    line1: "",
    city: "",
    state: "",
    zip: "",
  });
  assert.equal(result.pollingLocations, undefined);
  assert.equal(result.mailOnly, undefined);
});
void test("same-day jurisdictions/types/descriptions have distinct IDs and stable ordering", async () => {
  const records = [
    election,
    { ...election, ocdId: election.ocdId + "/county:test" },
    { ...election, type: "special" },
    { ...election, description: "Synthetic special" },
  ];
  const first = await client(page(records)).api.getElections("input");
  const reversed = await client(page([...records].reverse())).api.getElections(
    "input",
  );
  assert.deepEqual(first, reversed);
  assert.equal(new Set(first.map((e) => e.id)).size, 4);
  const { api, calls } = client(page(records));
  const chosen = first[2];
  assert.ok(chosen);
  const result = await api.getVoterInfo("input", chosen.id);
  assert.equal(result.election.id, chosen.id);
  assert.equal(calls[0]?.url.searchParams.get("endDate"), "2026-11-03");
  assert.equal(calls[0].url.searchParams.has("electionId"), false);
  assert.equal(result.otherElections?.length, 3);
});
void test("missing, invalid and stale election selection fail without fallback", async () => {
  const { api, calls } = client(page([election]));
  await assert.rejects(
    api.getVoterInfo("input", "google-2000"),
    (e) => e instanceof BallotProviderError && e.reason === "selection",
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    api.getVoterInfo("input", `dw:2026-11-03:${"0".repeat(64)}`),
    (e) => e instanceof BallotProviderError && e.reason === "selection",
  );
  assert.equal(calls.length, 1);
  await assert.rejects(
    client(page([])).api.getVoterInfo("input"),
    (e) => e instanceof BallotProviderError && e.reason === "empty",
  );
});
void test("statewide mapping failure and missing ballot data stay explicit", async () => {
  const result = await client(
    page([{ ...election, contests: undefined, ballotMeasures: undefined }], {
      statewideOnly: true,
    }),
  ).api.getVoterInfo("input");
  assert.equal(result.provider?.addressScope, "statewide_only");
  assert.equal(result.provider.ballotDataStatus, "unavailable");
  assert.equal(result.contests, undefined);
  const unknown = await client(
    page([election], { statewideOnly: undefined }),
  ).api.getVoterInfo("input");
  assert.equal(unknown.provider?.addressScope, "unknown");
});
void test("documented singleton ballot shape works; cancelled contests and unsafe links are omitted", async () => {
  const result = await client(
    page([
      {
        ...election,
        contests: { ...race, cancelled: true },
        ballotMeasures: election.ballotMeasures[0],
        website: "javascript:alert(1)",
      },
    ]),
  ).api.getVoterInfo("input");
  assert.equal(result.contests?.length, 1);
  assert.equal(result.contests[0]?.type, "referendum");
  assert.equal(
    result.state?.[0]?.electionAdministrationBody?.electionInfoUrl,
    undefined,
  );
});
void test("malformed payloads and duplicate identities fail closed", async () => {
  for (const payload of [
    page([{ ...election, contests: "wrong" }]),
    page([election, election]),
    { data: { elections: [] } },
    page([{ ...election, date: "invalid" }]),
  ]) {
    await assert.rejects(
      client(payload).api.getVoterInfo("input"),
      (e) => e instanceof BallotProviderError && e.reason === "response",
    );
  }
});
void test("missing replacement key and provider errors never fall back or expose provider payload", async () => {
  let count = 0;
  const fetch: typeof globalThis.fetch = () => {
    count++;
    return Promise.resolve(
      new Response("sensitive upstream body", { status: 403 }),
    );
  };
  await assert.rejects(
    createDemocracyWorksClient({ apiKey: () => undefined, fetch }).getVoterInfo(
      "input",
    ),
    (e) => e instanceof BallotProviderError && e.reason === "configuration",
  );
  assert.equal(count, 0);
  await assert.rejects(
    createDemocracyWorksClient({
      apiKey: () => "synthetic",
      fetch,
    }).getVoterInfo("input"),
    (e) => e instanceof BallotProviderError && !e.message.includes("sensitive"),
  );
  assert.equal(count, 1);
});
void test("pagination consumes at most two pages and rejects truncated discovery", async () => {
  let calls = 0;
  const api = createDemocracyWorksClient({
    apiKey: () => "synthetic",
    fetch: () => {
      calls++;
      return Promise.resolve(
        Response.json({
          data: {
            elections: Array.from({ length: 100 }, (_, i) => ({
              ...election,
              description: `Synthetic ${calls}-${i}`,
            })),
            statewideOnly: false,
          },
          pagination: {
            currentPage: calls,
            pageSize: 100,
            totalRecordCount: 201,
          },
        }),
      );
    },
  });
  await assert.rejects(
    api.getElections("input"),
    (e) => e instanceof BallotProviderError && e.reason === "pagination",
  );
  assert.equal(calls, 2);
});

for (const stage of ["headers", "body"] as const) {
  void test(`timeout aborts while waiting for ${stage}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let signal: AbortSignal | null | undefined;
    const api = createDemocracyWorksClient({
      apiKey: () => "synthetic",
      fetch: (_url, init) => {
        signal = init?.signal;
        const pending = new Promise<never>((_, reject) =>
          signal?.addEventListener(
            "abort",
            () => reject(new Error("timeout")),
            { once: true },
          ),
        );
        if (stage === "headers") return pending;
        const response = new Response();
        t.mock.method(response, "json", () => pending);
        return Promise.resolve(response);
      },
    });
    const result = api.getVoterInfo("input");
    const rejected = assert.rejects(
      result,
      (e) => e instanceof BallotProviderError && e.reason === "provider",
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(4_000);
    await rejected;
    assert.equal(signal?.aborted, true);
  });
}
