import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  collectRegionalMeasures,
  parseRegionalMeasure,
  regionalDocumentLinks,
} from "./ca-regional-measures-source.js";

const fixture = (name: string) =>
  readFileSync(
    new URL(`./__fixtures__/ca-regional-measures/${name}`, import.meta.url),
    "utf8",
  );
const district = fixture("district.html");
const county = fixture("county.html");
const legal = fixture("resolution-excerpt.txt");
const reviewedQuestion = fixture("ballot-question.txt").trim();

test("official regional record keeps five-county scope, ballot question and source identities", () => {
  const payload = parseRegionalMeasure(
    district,
    county,
    legal,
    new Date("2026-11-01T00:00:00Z"),
  );
  const measure = payload.measures[0]!;
  assert.equal(payload.electionDate, "2026-11-03");
  assert.equal(measure.designation, "RTM");
  assert.deepEqual(measure.counties, [
    "Alameda",
    "Contra Costa",
    "San Francisco",
    "San Mateo",
    "Santa Clara",
  ]);
  assert.equal(measure.ballotQuestion, reviewedQuestion);
  assert.match(measure.fullText, /everyone\. including workers\. students/);
  assert.match(measure.ballotQuestion, /0.5%/);
  assert.match(measure.ballotQuestion, /1%.*San Francisco/);
  assert.match(measure.ballotQuestion, /14 years/);
  assert.equal(measure.fullText, legal);
  assert.match(
    measure.fullTextUrl,
    /^https:\/\/smcacre.gov\/system\/files\/2026-07\//,
  );
  assert.match(measure.analysisUrl, /ImpartialAnalysis/);
  assert.notEqual(measure.argumentForUrl, measure.argumentAgainstUrl);
});

test("a clean PDF question matches the reviewed transcription and keeps raw legal text", () => {
  const cleanLegal = legal.replace(
    "everyone. including workers. students",
    "everyone, including workers, students",
  );
  const measure = parseRegionalMeasure(district, county, cleanLegal)
    .measures[0]!;
  assert.equal(measure.ballotQuestion, reviewedQuestion);
  assert.equal(measure.fullText, cleanLegal);
});

test("changed ballot words, tax terms or unreviewed punctuation require source review", () => {
  for (const [before, after] of [
    ["0.5%", "0.75%"],
    ["1% (San Francisco)", "2% (San Francisco)"],
    ["14 years", "15 years"],
    ["$980,000,000", "$990,000,000"],
    ["Preserving BART", "Expanding BART"],
    ["safety, cleanliness", "safety. cleanliness"],
  ] as const) {
    assert.throws(
      () =>
        parseRegionalMeasure(district, county, legal.replace(before, after)),
      /ballot question changed.*source review/i,
    );
  }
});

test("wrong election, missing question or changed source sections cannot replace the cache", () => {
  assert.throws(() =>
    parseRegionalMeasure(
      district.replaceAll("November 3, 2026", "November 3, 2030"),
      county,
      legal,
    ),
  );
  assert.throws(() => parseRegionalMeasure(district, county, "empty"));
  assert.throws(() =>
    regionalDocumentLinks(
      county.replace("Primary Argument Against", "removed"),
    ),
  );
  assert.throws(() =>
    regionalDocumentLinks(
      county.replaceAll(
        "https%3A%2F%2Fsmcacre.gov",
        "https%3A%2F%2Fevil.example",
      ),
    ),
  );
});

test("regional collection refuses an unbounded or unsupported item count before fetching", async () => {
  await assert.rejects(collectRegionalMeasures(2), /maxItems=1/);
});
