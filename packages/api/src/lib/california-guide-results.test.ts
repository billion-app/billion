import assert from "node:assert/strict";
import test from "node:test";

import type { OfficialGuidePayload } from "./official-guide-cache";
import {
  parseSosReportingTime,
  SOS_POLL_CLOSE,
} from "../clients/ca-sos-provenance";
import { loadCaliforniaGuideResults } from "./california-guide-results";

const guide = {
  electionDate: "2026-11-03",
  candidates: [{ name: "Alice Example", officeSlug: "governor" }],
  measures: [
    { number: "1", title: "Housing. Legislative Statute." },
    { number: "2", title: "Schools." },
  ],
} as OfficialGuidePayload;
const manifest =
  '"This file lists all available JSON endpoints for the California November 3, 2026 Statewide General Election"';
const time = "November 3, 2026, 8:01 p.m.";
const race = {
  raceTitle: "Governor - Statewide Results",
  ReportingTime: time,
  candidates: [
    { Name: "Alice Example", Votes: "30" },
    { Name: "Other Person", Votes: "70" },
  ],
};
const measure = (number: string, title: string) => ({
  raceTitle: "Ballot Measures - Statewide Results",
  ReportingTime: time,
  "ballot-measures": [
    { Number: number, Name: title, yesVotes: "50", noVotes: "50" },
  ],
});
function fetcher(overrides: Record<string, unknown> = {}) {
  return ((input: string | URL | Request) => {
    const file =
      (input instanceof Request ? input.url : input.toString())
        .split("/")
        .at(-1) ?? "";
    const body =
      overrides[file] ??
      (file === "json-endpoints.csv"
        ? manifest
        : file === "governor.json"
          ? [race]
          : [
              measure("01", "Housing. Legislative Statute."),
              measure("02", "Schools."),
            ]);
    return Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body)),
    );
  }) as typeof fetch;
}
const now = SOS_POLL_CLOSE + 120_000;

void test("before poll close does not request rehearsal feeds", async () => {
  const result = await loadCaliforniaGuideResults(guide, {
    now: SOS_POLL_CLOSE - 1,
    fetcher: (() => {
      throw new Error("must not fetch");
    }) as typeof fetch,
  });
  assert.equal(result.status, "pending");
});
void test("full race denominator and every statewide measure are retained", async () => {
  const result = await loadCaliforniaGuideResults(guide, {
    now,
    fetcher: fetcher(),
  });
  assert.equal(result.status, "reported");
  assert.equal(result.candidates["governor:Alice Example"]?.share, 30);
  assert.equal(
    result.candidates["governor:Alice Example"].standing,
    "trailing",
  );
  assert.deepEqual(Object.keys(result.measures), ["1", "2"]);
  assert.equal(result.measures["2"]?.yes.standing, "tied");
});
void test("wrong election manifest and guide cannot publish votes", async () => {
  for (const value of [
    manifest.replace("General", "Primary"),
    manifest.replace("2026", "2024"),
  ])
    assert.equal(
      (
        await loadCaliforniaGuideResults(guide, {
          now,
          fetcher: fetcher({ "json-endpoints.csv": value }),
        })
      ).status,
      "unavailable",
    );
  assert.equal(
    (
      await loadCaliforniaGuideResults(
        { ...guide, electionDate: "2024-11-05" },
        { now, fetcher: fetcher() },
      )
    ).status,
    "unavailable",
  );
});
void test("stale, future, county, duplicate and malformed races cannot attach", async () => {
  for (const races of [
    [{ ...race, ReportingTime: "October 28, 2026, 12:08 p.m." }],
    [{ ...race, ReportingTime: "November 4, 2026, 8:01 p.m." }],
    [{ ...race, raceTitle: "Governor - Alameda Results" }],
    [race, race],
    [{ ...race, candidates: [{ Name: "Alice Example", Votes: "-2" }] }],
    [{ ...race, candidates: [race.candidates[0], race.candidates[0]] }],
  ]) {
    const result = await loadCaliforniaGuideResults(guide, {
      now,
      fetcher: fetcher({ "governor.json": races }),
    });
    assert.equal(result.status, "reported");
    assert.deepEqual(result.candidates, {});
  }
});
void test("zero totals are explicit and names and titles require exact normalized matches", async () => {
  const result = await loadCaliforniaGuideResults(guide, {
    now,
    fetcher: fetcher({
      "governor.json": [
        {
          ...race,
          candidates: [
            { Name: "ALICE EXAMPLE", Votes: "0" },
            { Name: "Other Person", Votes: "0" },
          ],
        },
      ],
      "ballot-measures.json": [measure("01", "Different housing title")],
    }),
  });
  assert.equal(result.status, "reported");
  {
    assert.equal(
      result.candidates["governor:Alice Example"]?.standing,
      "no-votes",
    );
    assert.deepEqual(result.measures, {});
  }
});
void test("Pacific timestamps handle DST, noon, midnight and invalid dates", () => {
  assert.equal(parseSosReportingTime(time), SOS_POLL_CLOSE + 60_000);
  assert.equal(
    parseSosReportingTime("June 3, 2026, 12:00 p.m."),
    Date.parse("2026-06-03T19:00:00Z"),
  );
  assert.equal(
    parseSosReportingTime("November 3, 2026, 12:00 a.m."),
    Date.parse("2026-11-03T08:00:00Z"),
  );
  assert.equal(parseSosReportingTime("February 30, 2026, 1:00 p.m."), null);
});

void test("rounding does not create ties and malformed totals cannot attach", async () => {
  const result = await loadCaliforniaGuideResults(guide, {
    now,
    fetcher: fetcher({
      "governor.json": [
        {
          ...race,
          candidates: [
            { Name: "Alice Example", Votes: "100001" },
            { Name: "Other Person", Votes: "100000" },
          ],
        },
      ],
    }),
  });
  assert.equal(result.status, "reported");
  assert.equal(
    result.candidates["governor:Alice Example"]?.standing,
    "leading",
  );
  for (const value of ["NaN", "Infinity", "12x", "1,23", "9007199254740992"]) {
    const invalid = await loadCaliforniaGuideResults(guide, {
      now,
      fetcher: fetcher({
        "governor.json": [
          { ...race, candidates: [{ Name: "Alice Example", Votes: value }] },
        ],
      }),
    });
    assert.equal(invalid.status, "reported");
    assert.deepEqual(invalid.candidates, {});
  }
});
void test("one unavailable feed preserves independent matches and duplicate measures are withheld", async () => {
  const base = fetcher({
    "ballot-measures.json": [
      measure("01", "Housing. Legislative Statute."),
      measure("01", "Housing. Legislative Statute."),
      measure("02", "Schools."),
    ],
  });
  const result = await loadCaliforniaGuideResults(guide, {
    now,
    fetcher: (async (input, init) => {
      if (
        (input instanceof Request ? input.url : input.toString()).endsWith(
          "governor.json",
        )
      )
        throw new Error("unavailable");
      return await base(input, init);
    }) as typeof fetch,
  });
  assert.equal(result.status, "reported");
  assert.deepEqual(result.candidates, {});
  assert.deepEqual(Object.keys(result.measures), ["2"]);
});

void test("internal full roster fetches governor when no statement was submitted", async () => {
  const withoutGovernor = { ...guide, candidates: [] };
  const legacy = await loadCaliforniaGuideResults(withoutGovernor, {
    now,
    fetcher: fetcher(),
  });
  assert.deepEqual(legacy.status === "reported" ? legacy.candidates : {}, {});
  const full = await loadCaliforniaGuideResults(withoutGovernor, {
    now,
    fetcher: fetcher(),
    fullRoster: true,
  });
  assert.equal(full.status, "reported");
  assert.deepEqual(Object.keys(full.candidates).sort(), [
    "governor:Alice Example",
    "governor:Other Person",
  ]);
  assert.equal(full.candidates["governor:Other Person"]?.share, 70);
});
