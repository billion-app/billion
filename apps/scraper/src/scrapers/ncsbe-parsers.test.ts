import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseCandidateCsv,
  parseReferendumLines,
  parseResultsTsv,
  restrictToCycle,
} from "./ncsbe-parsers.js";

const fixture = (name: string) =>
  readFile(new URL(`../fixtures/ncsbe/${name}`, import.meta.url), "utf8");

test("parses current-cycle candidate CSV without private contact fields", async () => {
  const rows = parseCandidateCsv(await fixture("candidates-2026.csv"));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    electionDate: "2026-03-03",
    county: "DURHAM",
    contest: "US HOUSE OF REPRESENTATIVES DISTRICT 04",
    name: "Nida Allam",
    party: "DEM",
    voteFor: 1,
    termYears: 2,
    hasPrimary: true,
    isPartisan: true,
  });
  assert.equal("email" in rows[0]!, false);
  assert.deepEqual(
    rows.map((row) => row.county),
    ["DURHAM", "WAKE"],
  );
});

test("parses NCSBE result layouts from 2026 and 2024 fixtures", async () => {
  const current = parseResultsTsv(await fixture("results-2026.tsv"));
  const legacy = parseResultsTsv(await fixture("results-2024.tsv"));
  assert.equal(current.length, 2);
  assert.equal(current[0]?.totalVotes, 371);
  assert.equal(current[0]?.earlyVotingVotes, 0);
  assert.equal(legacy.length, 2);
  assert.equal(legacy[0]?.choice, "Kamala D. Harris");
  assert.deepEqual(restrictToCycle([...current, ...legacy], 2026), current);
});

test("parses current-cycle referendum PDF text across counties", async () => {
  const rows = parseReferendumLines(
    (await fixture("referendums-2026.txt")).split(/\r?\n/),
  );
  assert.equal(rows.length, 4);
  assert.deepEqual(
    [...new Set(rows.map((row) => row.county))],
    ["GATES", "GRANVILLE"],
  );
  assert.equal(rows[0]?.electionDate, "2026-03-03");
  assert.equal(rows[0]?.choice, "For");
});
