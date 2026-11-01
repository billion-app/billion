import assert from "node:assert/strict";
import test from "node:test";

import { regionalMeasureRoute } from "./regional-measures";

void test("regional reader navigation carries the question and official links without the full law or statewide graph identity", () => {
  const measure = {
    id: "ca-ptrmd-2026-11-03-rtm" as const,
    designation: "RTM" as const,
    title: "Regional Transit Measure",
    districtName: "Public Transit Revenue Measure District" as const,
    counties: [
      "Alameda",
      "Contra Costa",
      "San Francisco",
      "San Mateo",
      "Santa Clara",
    ] as [
      "Alameda",
      "Contra Costa",
      "San Francisco",
      "San Mateo",
      "Santa Clara",
    ],
    sourceName: "Public Transit Revenue Measure District",
    sourceUrl: "https://mtc.ca.gov/",
    officialOverview: "Official district overview",
    ballotQuestion: "Official ballot question?",
    fullTextUrl: "https://smcacre.gov/law.pdf",
    analysisUrl: "https://smcacre.gov/analysis.pdf",
    argumentForUrl: "https://smcacre.gov/for.pdf",
    argumentAgainstUrl: "https://smcacre.gov/against.pdf",
  };
  const route = regionalMeasureRoute(measure, "2026-11-03");
  assert.equal(route.pathname, "/measure-detail");
  assert.equal(route.params.summary, measure.ballotQuestion);
  assert.match(route.params.measureScope, /San Francisco/);
  assert.equal(route.params.referendumUrl, measure.fullTextUrl);
  assert.equal("number" in route.params, false);
  assert.equal("referendumText" in route.params, false);
  assert.match(route.params.citations, /https:\/\/smcacre.gov\/law.pdf/);
});
