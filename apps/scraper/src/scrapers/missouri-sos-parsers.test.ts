import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverMissouriResultsUrl,
  parseMissouriBallotMeasures,
  parseMissouriCalendar,
  parseMissouriCandidateDiscovery,
  parseMissouriCandidateOffice,
  parseMissouriResults,
  parseMissouriWithdrawals,
} from "./missouri-sos-parsers.js";

const fixture = (name: string) =>
  readFile(
    new URL(`../fixtures/missouri-sos/${name}`, import.meta.url),
    "utf8",
  );

void test("discovers the active primary and dynamic certified candidate endpoints", async () => {
  const active = parseMissouriCalendar(
    await fixture("calendar.html"),
    new Date("2026-07-22T12:00:00Z"),
  );
  assert.equal(active.type, "primary");
  assert.equal(active.electionDate, "2026-08-04");
  assert.equal(active.finalCertificationDate, "2026-05-26");
  assert.equal(
    parseMissouriCalendar(
      await fixture("calendar.html"),
      new Date("2026-08-10T12:00:00Z"),
      undefined,
      "primary",
    ).type,
    "primary",
  );

  const discovery = parseMissouriCandidateDiscovery(
    await fixture("candidate-index.html"),
  );
  assert.equal(discovery.electionCode, "750006905");
  assert.equal(discovery.offices.length, 2);
  assert.match(discovery.candidatesUrl, /ElectionCode=750006905/);
  assert.match(discovery.withdrawalsUrl, /CandidatesRemoved/);
});

void test("parses ballot order, parties, districts, and excludes candidate addresses", async () => {
  const candidates = parseMissouriCandidateOffice(
    await fixture("candidates.html"),
    "https://s1.sos.mo.gov/candidatesonweb/cumulative",
  );
  assert.deepEqual(
    candidates.map(({ name, party, office, district, ballotOrder }) => ({
      name,
      party,
      office,
      district,
      ballotOrder,
    })),
    [
      {
        name: "Alice First",
        party: "Republican",
        office: "State Senator",
        district: "2",
        ballotOrder: 1,
      },
      {
        name: "Bob Second",
        party: "Republican",
        office: "State Senator",
        district: "2",
        ballotOrder: 2,
      },
      {
        name: "Carol Third",
        party: "Democratic",
        office: "State Senator",
        district: "2",
        ballotOrder: 1,
      },
      {
        name: "Dana Fourth",
        party: "Libertarian",
        office: "State Representative",
        district: "11",
        ballotOrder: 1,
      },
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(candidates),
    /Secret|Private|Hidden|Confidential/,
  );
});

void test("parses withdrawals without retaining their address nodes", async () => {
  const candidates = parseMissouriWithdrawals(
    await fixture("withdrawals.html"),
    "https://s1.sos.mo.gov/candidatesonweb/withdrawals",
  );
  assert.equal(candidates[0]?.status, "withdrawn");
  assert.equal(candidates[0]?.withdrawalDate, "2026-06-09");
  assert.equal(candidates[1]?.status, "removed");
  assert.doesNotMatch(JSON.stringify(candidates), /Private Street|PO Box/);
});

void test("parses only certified 2026 measures with language, fiscal text, and source files", async () => {
  const measures = parseMissouriBallotMeasures(await fixture("measures.html"));
  assert.equal(measures.length, 2);
  assert.deepEqual(
    measures.map((measure) => [measure.officialTitle, measure.electionDate]),
    [
      ["Amendment 1", "2026-08-04"],
      ["Amendment 3", "2026-11-03"],
    ],
  );
  assert.match(measures[0]?.officialBallotLanguage ?? "", /Constitution/);
  assert.match(measures[0]?.fairBallotLanguage ?? "", /yes/);
  assert.match(measures[0]?.fiscalStatement ?? "", /costs or savings/);
  assert.match(measures[0]?.certificateUrl ?? "", /certificate-amendment-1/);
});

void test("fails soft when current results are absent and detects deterministic updates", async () => {
  const active = parseMissouriCalendar(
    await fixture("calendar.html"),
    new Date("2026-07-22T12:00:00Z"),
  );
  assert.equal(
    discoverMissouriResultsUrl(
      await fixture("showmo-unavailable.html"),
      active,
    ),
    null,
  );
  assert.equal(
    discoverMissouriResultsUrl(
      '<section>August 4, 2026 Primary <a href="/elections/2026-primary-results">Election Results</a></section>',
      active,
    ),
    "https://www.sos.mo.gov/elections/2026-primary-results",
  );

  const layout = await fixture("historical-results-layout.html");
  const first = parseMissouriResults(
    layout,
    "https://example.test/fixture-only",
  );
  const updated = parseMissouriResults(
    layout.replace("1,250", "1,300").replace("11:45 PM", "11:55 PM"),
    "https://example.test/fixture-only",
  );
  assert.equal(first.contests[0]?.totalVotes, 2399);
  assert.equal(updated.contests[0]?.totalVotes, 2449);
  assert.notEqual(first.updatedAt, updated.updatedAt);
});
