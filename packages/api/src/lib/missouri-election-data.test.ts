import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSOURI_CYCLE_YEAR,
  missouriSnapshotDataSchema,
} from "./missouri-election-data";

const currentSnapshot = {
  cycleYear: MISSOURI_CYCLE_YEAR,
  activeElection: {
    name: "2026 Primary Election",
    type: "primary",
    electionDate: "2026-08-04",
    citation: {
      label: "Official calendar",
      sourceUrl: "https://www.sos.mo.gov/elections/calendar/2026cal",
    },
  },
  candidates: [],
  ballotMeasures: [],
  results: {
    availability: "unavailable",
    diagnostic: "Official results are not yet available",
    citation: {
      label: "ShowMO Votes",
      sourceUrl: "https://www.sos.mo.gov/elections/showmovotes",
    },
  },
  citations: [],
} as const;

void test("accepts the current-cycle unavailable-results handoff", () => {
  const parsed = missouriSnapshotDataSchema.parse(currentSnapshot);
  assert.equal(parsed.cycleYear, 2026);
  assert.equal(parsed.results.availability, "unavailable");
});

void test("rejects a historical cycle at the API boundary", () => {
  assert.throws(() =>
    missouriSnapshotDataSchema.parse({ ...currentSnapshot, cycleYear: 2024 }),
  );
});
