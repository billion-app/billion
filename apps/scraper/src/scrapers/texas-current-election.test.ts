import assert from "node:assert/strict";
import test from "node:test";

import { discoverLatestTlcAnalysis } from "./texas-current-election.js";

void test("TLC discovery chooses the newest full report and skips condensed PDFs", () => {
  const html = `
    <a href="/docs/amendments/analyses23.pdf">November 7, 2023</a>
    <a href="/docs/amendments/analyses25_condensed.pdf">Condensed</a>
    <a href="/docs/amendments/analyses25.pdf">2025</a>
  `;
  assert.deepEqual(discoverLatestTlcAnalysis(html), {
    year: 2025,
    title: "2025",
    url: "https://tlc.texas.gov/docs/amendments/analyses25.pdf",
  });
});
