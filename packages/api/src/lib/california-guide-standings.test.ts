import assert from "node:assert/strict";
import { test } from "node:test";

import type { CaliforniaPollingReport } from "./california-polling";
import type { OfficialGuidePayload } from "./official-guide-cache";
import { selectCaliforniaGuideStandings } from "./california-guide-standings";
import { californiaPollingReportSchema } from "./california-polling";

const guide: OfficialGuidePayload = {
  electionDate: "2026-11-03",
  jurisdiction: "CA",
  complete: true,
  fetchedAt: "2026-10-29T12:00:00Z",
  sourceUrl: "https://voterguide.sos.ca.gov/",
  measures: [
    {
      number: "37",
      title: "A TEST TITLE. INITIATIVE STATUTE.",
      sourceUrl: "https://voterguide.sos.ca.gov/propositions/37/",
    },
  ],
  candidates: [
    {
      officeSlug: "controller",
      name: "Test Candidate",
      statement: "Fixture",
      sourceUrl: "https://voterguide.sos.ca.gov/",
    },
  ],
};
const report: CaliforniaPollingReport = {
  electionDate: "2026-11-03",
  electionType: "general",
  jurisdiction: "CA",
  publisher: "PPIC",
  pollster: "PPIC",
  sponsor: null,
  reportId: "synthetic",
  sourceUrl: "https://www.ppic.org/test.pdf",
  sourceHash: "a".repeat(64),
  retrievedAt: "2026-10-29T12:00:00Z",
  publishedAt: "2026-10-27",
  fieldStart: "2026-10-16",
  fieldEnd: "2026-10-22",
  sampleSize: 1086,
  marginOfError: 3.8,
  marginOfErrorScope: "Survey likely voters, 95% confidence",
  methodology: "Probability online panel",
  sourceText: "Private source text",
  observations: [
    {
      questionId: "Q24",
      locator: "Q24 page 20",
      questionText: "Synthetic test question",
      contest: {
        type: "measure",
        number: "37",
        officialTitle: "A TEST TITLE. INITIATIVE STATUTE.",
      },
      population: "California statewide likely voters",
      sampleSize: 1079,
      choices: [
        { kind: "yes", label: "Yes", share: 65 },
        { kind: "no", label: "No", share: 32 },
        { kind: "undecided", label: "Don't know", share: 4 },
      ],
    },
  ],
};
const observation = report.observations[0];
assert.ok(observation);
const pending = {
  electionDate: guide.electionDate,
  sourceUrl: "https://electionresults.sos.ca.gov/",
  status: "pending" as const,
};
const now = Date.parse("2026-10-29T18:00:00Z");
void test("raw published 101% totals and question denominator survive without source document exposure", () => {
  const snapshot = selectCaliforniaGuideStandings(
    guide,
    pending,
    [report],
    now,
  );
  const measure = snapshot.measures["37"];
  assert.equal(measure?.kind, "poll");
  assert.deepEqual(
    measure.poll.observation.choices.map((choice) => choice.share),
    [65, 32, 4],
  );
  assert.equal(measure.poll.observation.sampleSize, 1079);
  assert.equal(measure.poll.report.sampleSize, 1086);
  assert.equal("sourceText" in measure.poll.report, false);
  assert.equal("votes" in (measure.poll.observation.choices[0] ?? {}), false);
  assert.deepEqual(snapshot.candidates["controller:Test Candidate"], {
    kind: "none",
  });
});
void test("latest complete observation wins and new governor report preserves older measure coverage", () => {
  const newer = structuredClone(report);
  newer.reportId = "new-governor";
  newer.fieldStart = "2026-10-23";
  newer.fieldEnd = "2026-10-25";
  newer.observations = [
    {
      ...observation,
      contest: {
        type: "candidate",
        officeSlug: "governor",
        candidateNames: ["Xavier Becerra", "Steve Hilton"],
      },
      choices: [
        {
          kind: "candidate",
          label: "Xavier Becerra",
          candidateName: "Xavier Becerra",
          share: 61,
        },
        {
          kind: "candidate",
          label: "Steve Hilton",
          candidateName: "Steve Hilton",
          share: 37,
        },
        { kind: "other", label: "Neither", share: 1 },
        { kind: "undecided", label: "Don't know", share: 1 },
      ],
    },
  ];
  const snapshot = selectCaliforniaGuideStandings(
    guide,
    pending,
    [report, newer],
    now,
  );
  assert.equal(snapshot.governor.kind, "poll");
  assert.equal(snapshot.measures["37"]?.kind, "poll");
  const revised = structuredClone(report);
  assert.ok(revised.observations[0]);
  assert.ok(revised.observations[0].choices[0]);
  revised.fieldEnd = "2026-10-25";
  revised.observations[0].choices[0].share = 64;
  const selected = selectCaliforniaGuideStandings(
    guide,
    pending,
    [report, revised],
    now,
  ).measures["37"];
  assert.equal(
    selected?.kind === "poll" && selected.poll.observation.choices[0]?.share,
    64,
  );
});
void test("future, primary, wrong cycle, title and subgroup records do not attach", () => {
  for (const change of [
    { fieldEnd: "2026-10-30", publishedAt: null },
    { electionDate: "2024-11-05" },
    { electionType: "primary" },
    {
      observations: [
        { ...observation, population: "Republican likely voters" },
      ],
    },
    {
      observations: [
        {
          ...observation,
          contest: {
            type: "measure",
            number: "37",
            officialTitle: "Different wording",
          },
        },
      ],
    },
  ]) {
    assert.equal(
      selectCaliforniaGuideStandings(
        guide,
        pending,
        [{ ...report, ...change }],
        now,
      ).measures["37"]?.kind,
      "none",
    );
  }
});
void test("positive official results supersede polling while zero counted votes preserve polling", () => {
  const counted = {
    yes: {
      votes: 60,
      share: 60,
      standing: "leading" as const,
      rank: 1,
      fieldSize: 2,
    },
    no: {
      votes: 40,
      share: 40,
      standing: "trailing" as const,
      rank: 2,
      fieldSize: 2,
    },
    totalVotes: 100,
    reportingLabel: "partial",
    reportedAt: "2026-11-04T05:00:00Z",
    sourceUrl: pending.sourceUrl,
  };
  const official = {
    ...pending,
    status: "reported" as const,
    candidates: {},
    measures: { "37": counted },
  };
  assert.equal(
    selectCaliforniaGuideStandings(guide, official, [report], now).measures[
      "37"
    ]?.kind,
    "official",
  );
  official.measures["37"].totalVotes = 0;
  assert.equal(
    selectCaliforniaGuideStandings(guide, official, [report], now).measures[
      "37"
    ]?.kind,
    "poll",
  );
});
void test("schema rejects invalid calendar dates, duplicate choices, missing names and unreasonable totals", () => {
  assert.equal(californiaPollingReportSchema.safeParse(report).success, true);
  for (const value of [
    { ...report, fieldStart: "2026-02-30" },
    { ...report, publishedAt: "2026-10-20" },
    { ...report, sourceUrl: "https://fake.example/poll.pdf" },
    {
      ...report,
      observations: [
        {
          ...observation,
          choices: [
            { kind: "yes", label: "Yes", share: 40 },
            { kind: "yes", label: "Yes", share: 60 },
          ],
        },
      ],
    },
  ])
    assert.equal(californiaPollingReportSchema.safeParse(value).success, false);
});
