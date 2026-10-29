import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverPpicReports,
  PPIC_REPORT_CATALOG,
} from "./ca-election-polling-source.js";

test("an unavailable index refreshes the explicit researched catalog", async () => {
  const reports = await discoverPpicReports(async () => {
    throw new Error("HTTP 403");
  });
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.sourceUrl, PPIC_REPORT_CATALOG[0].sourceUrl);
});
test("new report PDFs are discovered with null publication dates when the source omits them", async () => {
  const reports = await discoverPpicReports(
    async (url) =>
      new Response(
        url.endsWith("/survey/")
          ? '<a href="/publication/ppic-statewide-survey-californians-and-their-government-november-2026/">Survey</a>'
          : '<a href="/wp-content/uploads/crosstabs-likely-voters-1126.pdf">Likely voters</a>',
      ),
  );
  assert.equal(reports.length, 2);
  assert.equal(
    reports.find((report) => report.reportId.endsWith("1126"))?.publishedAt,
    null,
  );
});
test("new publications without supported crosstabs fail visibly", async () => {
  await assert.rejects(
    discoverPpicReports(
      async (url) =>
        new Response(
          url.endsWith("/survey/")
            ? '<a href="/publication/ppic-statewide-survey-californians-and-their-government-november-2026/">Survey</a>'
            : "No likely-voter PDF",
        ),
    ),
    /no supported likely-voter PDF/,
  );
});
