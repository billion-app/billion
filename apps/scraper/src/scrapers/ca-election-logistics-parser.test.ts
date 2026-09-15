import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCaElectionLogistics } from "./ca-election-logistics-parser.js";

const url =
  "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026/key-dates-deadlines";
const day =
  "<tr><td>Election Day - Polls shall be open throughout the state from 7:00 a.m. to 8:00 p.m.</td><td>November 3, 2026</td></tr>";
const registration =
  '<tr><td>Last day to <a href="https://registertovote.ca.gov/">register to vote</a> for the general election.</td><td>October 19, 2026</td></tr>';
void test("extracts only supplied statewide guidance with exact election/source identity", () => {
  const result = parseCaElectionLogistics(
    `<table>${day}${registration}<tr><td>Voter’s Choice Act counties to open Vote Centers</td><td>October 24, 2026</td></tr></table>`,
    url,
    new Date("2026-09-15T12:00:00Z"),
  );
  assert.equal(result.electionDate, "2026-11-03");
  assert.deepEqual(
    result.items.map((x) => x.kind),
    ["election_day", "registration"],
  );
  assert.equal(
    result.items[1]?.links[0]?.url,
    "https://registertovote.ca.gov/",
  );
  assert.equal(result.coverage, "statewide_guidance_only");
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
});
void test("rejects stale primary table under general URL, missing date and duplicate guidance", () => {
  assert.throws(() =>
    parseCaElectionLogistics(
      `<table>${day.replace("November 3", "June 2")}</table>`,
      url,
    ),
  );
  assert.throws(() =>
    parseCaElectionLogistics(`<table>${registration}</table>`, url),
  );
  assert.throws(() =>
    parseCaElectionLogistics(`<table>${day}${day}</table>`, url),
  );
  assert.throws(() =>
    parseCaElectionLogistics(
      `<table>${day}${registration.replace("2026", "2024")}</table>`,
      url,
    ),
  );
  assert.throws(() =>
    parseCaElectionLogistics(
      `<table>${day}</table>`,
      url.replace("www.sos.ca.gov", "example.org"),
    ),
  );
});
