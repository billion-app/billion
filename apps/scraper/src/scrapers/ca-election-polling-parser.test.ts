import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { PollPdfItem, PollPdfPage } from "./ca-election-polling-parser.js";
import { parsePpicPages, parsePpicPdf } from "./ca-election-polling-parser.js";

const source = {
  reportId: "crosstabs-likely-voters-1026",
  sourceUrl:
    "https://www.ppic.org/wp-content/uploads/crosstabs-likely-voters-1026.pdf",
  publishedAt: "2026-10-27",
};
const now = new Date("2026-10-29T12:00:00Z");
const item = (str: string, x: number, y: number): PollPdfItem => ({
  str,
  x,
  y,
});
const method =
  "Full Crosstabs–Likely Voters Only. Ipsos KnowledgePanel. Interviewing took place from October 16—22, 2026. A subgroup of 1,086 likely voters. Sampling error is ±3.8 percent at the 95 percent confidence level.";
function fixture(): PollPdfPage[] {
  return [
    { number: 1, items: [item(method, 72, 300)] },
    {
      number: 14,
      items: [
        item("Likely voters", 172, 528),
        item(
          "Q13. If the November 3rd election for governor were being held today, would you vote for….",
          13,
          480,
        ),
        item("Xavier Becerra, a Democrat", 92, 510),
        item("Steve Hilton, a Republican", 92, 490),
        item("neither/would not vote for governor (vol)", 92, 470),
        item("don’t know (vol)", 92, 450),
        item("Unweighted n", 92, 430),
        item("61%", 187, 510),
        item("37%", 187, 490),
        item("1%", 187, 470),
        item("1%", 187, 450),
        item("1083", 187, 430),
        item("92%", 226, 510),
        item("7%", 226, 490),
        item("Dem-Rep Seat", 190, 410),
        item("Q13. subgroup duplicate", 13, 380),
        item("99%", 187, 380),
      ],
    },
    {
      number: 37,
      items: [
        item("Likely voters", 172, 528),
        item(
          "Q31. Proposition 44 is called “Requires Community Health Clinics Spend 90% Of Revenue On Program Services. Initiative Statute. If the election were held today, would you vote yes or no?",
          13,
          480,
        ),
        item("yes", 92, 510),
        item("no", 92, 490),
        item("don't know (vol)", 92, 470),
        item("Unweighted n", 92, 450),
        item("25%", 187, 510),
        item("71%", 187, 490),
        item("4%", 187, 470),
        item("1074", 187, 450),
        item("90%", 30, 473),
        item("23%", 226, 510),
        item("Dem-Rep Seat", 190, 410),
      ],
    },
  ];
}
test("extracts statewide choices, question sample and source title independently of question percentages and subgroups", () => {
  const report = parsePpicPages(fixture(), source, "a".repeat(64), now);
  assert.equal(report.sampleSize, 1086);
  assert.equal(report.marginOfError, 3.8);
  assert.equal(report.observations.length, 2);
  assert.equal(report.observations[0]?.sampleSize, 1083);
  assert.deepEqual(
    report.observations[0]?.choices.map((choice) => choice.share),
    [61, 37, 1, 1],
  );
  assert.deepEqual(
    report.observations[1]?.choices.map((choice) => choice.share),
    [25, 71, 4],
  );
  assert.equal(report.fieldStart, "2026-10-16");
  assert.equal(report.fieldEnd, "2026-10-22");
});
test("fails visibly for malformed reports, future fieldwork, wrong cycle and missing statewide values", () => {
  assert.throws(() => parsePpicPages([], source, "a".repeat(64), now));
  assert.throws(
    () =>
      parsePpicPages(
        fixture(),
        { ...source, expectedObservationCount: 15 },
        "a".repeat(64),
        now,
      ),
    /Expected 15/,
  );
  assert.throws(() =>
    parsePpicPages(
      fixture(),
      source,
      "a".repeat(64),
      new Date("2026-10-20T12:00:00Z"),
    ),
  );
  const wrong = fixture();
  wrong[0]!.items[0]!.str = method.replaceAll("2026", "2024");
  assert.throws(() => parsePpicPages(wrong, source, "a".repeat(64), now));
  const missing = fixture();
  missing[1]!.items = missing[1]!.items.filter((entry) => entry.str !== "61%");
  assert.throws(() => parsePpicPages(missing, source, "a".repeat(64), now));
});
test("preserves an unreported publication date", () => {
  assert.equal(
    parsePpicPages(
      fixture(),
      { ...source, publishedAt: null },
      "a".repeat(64),
      now,
    ).publishedAt,
    null,
  );
});
test(
  "actual PPIC October PDF yields governor plus all fourteen measures",
  { skip: !process.env.PPIC_PDF_PATH },
  async () => {
    const report = await parsePpicPdf(
      new Uint8Array(await readFile(process.env.PPIC_PDF_PATH!)),
      source,
      now,
    );
    assert.equal(report.observations.length, 15);
    assert.deepEqual(
      report.observations[0]?.choices.map((choice) => choice.share),
      [61, 37, 1, 1],
    );
    assert.equal(report.observations[0]?.sampleSize, 1083);
    const expected = [
      ["1", 60, 38, 2],
      ["2", 61, 38, 1],
      ["3", 58, 41, 1],
      ["4", 45, 52, 3],
      ["5", 45, 52, 3],
      ["37", 65, 32, 4],
      ["38", 57, 41, 2],
      ["39", 41, 58, 1],
      ["40", 46, 52, 2],
      ["41", 48, 49, 3],
      ["42", 51, 47, 2],
      ["43", 42, 55, 3],
      ["44", 25, 71, 4],
      ["45", 46, 50, 4],
    ] as const;
    for (const [number, ...shares] of expected) {
      const observation = report.observations.find(
        (value) =>
          value.contest.type === "measure" && value.contest.number === number,
      );
      assert.deepEqual(
        observation?.choices.map((choice) => choice.share),
        shares,
        number,
      );
      assert.ok(observation?.sampleSize && observation.sampleSize < 1086);
    }
    const rounded = report.observations.find(
      (value) =>
        value.contest.type === "measure" && value.contest.number === "37",
    );
    assert.equal(
      rounded?.choices.reduce((sum, choice) => sum + choice.share, 0),
      101,
    );
  },
);
