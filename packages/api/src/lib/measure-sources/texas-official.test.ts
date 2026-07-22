import assert from "node:assert/strict";
import test from "node:test";

import type { TexasCurrentElectionData } from "../texas-election-data";
import { matchTexasOfficialMeasure } from "./texas-official";

const current: TexasCurrentElectionData = {
  jurisdiction: "TX",
  cycleYear: 2026,
  elections: [],
  fetchedAt: "2026-07-21T00:00:00.000Z",
  diagnostics: [],
  constitutionalAmendments: {
    cycleYear: 2025,
    electionDate: "November 4, 2025",
    citation: {
      sourceName: "Texas Legislative Council",
      sourceUrl: "https://tlc.texas.gov/docs/amendments/analyses25.pdf",
      provider: "texas-tlc",
      official: true,
    },
    measures: [
      {
        propositionNumber: 1,
        ballotLanguage:
          "The constitutional amendment creating a permanent technical institution infrastructure fund.",
        summaryAnalysis: "Creates a dedicated education infrastructure fund.",
        supporterArguments: ["Supporters say the fund expands training."],
        opponentArguments: ["Opponents question a permanent appropriation."],
        fiscalImplications: ["The legislature appropriated $850 million."],
        pageStart: 10,
        pageEnd: 17,
        diagnostics: [],
        citations: {
          summaryAnalysis: {
            sourceName: "Texas Legislative Council",
            sourceUrl:
              "https://tlc.texas.gov/docs/amendments/analyses25.pdf#page=10",
            provider: "texas-tlc",
            official: true,
            page: 10,
          },
        },
        result: {
          status: "complete",
          outcome: "adopted",
          totalVotes: 100,
          choices: [
            {
              name: "FOR",
              incumbent: false,
              votes: 70,
              percent: 70,
              winner: true,
            },
            {
              name: "AGAINST",
              incumbent: false,
              votes: 30,
              percent: 30,
              winner: false,
            },
          ],
          citation: {
            sourceName: "Texas Secretary of State",
            sourceUrl:
              "https://goelect.txelections.civixapps.com/ivis-enr-ui/races",
            provider: "texas-sos",
            official: true,
          },
        },
      },
    ],
  },
};

void test("matches Google/Vote Smart-style titles by date and proposition number", () => {
  const matched = matchTexasOfficialMeasure(
    "Texas Proposition 1, Technical Education Fund Amendment",
    {
      stateAbbrev: "TX",
      electionYear: 2025,
      electionDate: "2025-11-04",
    },
    current,
  );
  const amendment = current.constitutionalAmendments;
  assert.ok(amendment);
  assert.ok(matched.sos);
  assert.ok(matched.tlc);
  assert.equal(matched.sos.result?.outcome, "adopted");
  assert.equal(
    matched.tlc.officialSummary,
    amendment.measures[0]?.summaryAnalysis,
  );
  assert.equal(matched.sos.sourceName, "Texas Secretary of State");
  assert.equal(matched.tlc.sourceName, "Texas Legislative Council");
});

void test("rejects a proposition from a different election date", () => {
  const matched = matchTexasOfficialMeasure(
    "Proposition 1",
    {
      stateAbbrev: "TX",
      electionYear: 2025,
      electionDate: "2025-05-03",
    },
    current,
  );
  assert.deepEqual(matched, {});
});
