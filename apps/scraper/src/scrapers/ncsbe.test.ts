import assert from "node:assert/strict";
import test from "node:test";

import { discoverCurrentCycleFiles } from "./ncsbe.js";

test("discovers structured current-cycle files without accepting history", () => {
  const candidates = `
    <a href="/Candidate_Listing_2026.csv">2026 Candidate List Spreadsheet (CSV)</a>
    <a href="/Candidate_Listing_2024.csv">2024 Candidate List Spreadsheet (CSV)</a>
    <a href="/referendums_20260303.pdf">2026 Primary Referendum List</a>`;
  const results = `
    <a href="/results_pct_20260303.zip">2026 Mar 03 Election - Results (ZIP)</a>
    <a href="/results_pct_20241105.zip">2024 Nov 05 Election - Results (ZIP)</a>`;
  const files = discoverCurrentCycleFiles(candidates, results, 2026);
  assert.deepEqual(
    files.map((file) => file.kind),
    ["candidates", "referenda", "results"],
  );
  assert.ok(files.every((file) => file.url.includes("2026")));
});
