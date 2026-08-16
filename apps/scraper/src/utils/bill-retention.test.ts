import assert from "node:assert/strict";
import test from "node:test";

import type { BillRetentionCandidate } from "./bill-retention.js";
import { retentionJurisdiction, selectBillsToEvict } from "./bill-retention.js";

function candidate(
  id: string,
  jurisdiction: "US" | "CA",
  sourceUpdatedAt: string | null,
  lastActionAt = "2026-01-01T00:00:00Z",
): BillRetentionCandidate {
  return {
    id,
    billNumber:
      jurisdiction === "US" ? `H.R. ${id}` : `CA AB ${id} (2025-2026)`,
    sourceWebsite: jurisdiction === "US" ? "congress.gov" : "openstates.org",
    sourceUpdatedAt: sourceUpdatedAt ? new Date(sourceUpdatedAt) : null,
    lastActionAt: new Date(lastActionAt),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

void test("retention is capped independently per jurisdiction", () => {
  const rows = [
    ...Array.from({ length: 101 }, (_, index) =>
      candidate(
        `us-${index}`,
        "US",
        `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      ),
    ),
    ...Array.from({ length: 101 }, (_, index) =>
      candidate(
        `ca-${index}`,
        "CA",
        `2026-02-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      ),
    ),
  ];

  const evicted = selectBillsToEvict(rows, 100);
  assert.equal(evicted.length, 2);
  assert.deepEqual(evicted.map((row) => row.jurisdiction).sort(), ["CA", "US"]);
});

void test("source update wins, with legislative action as its fallback", () => {
  const evicted = selectBillsToEvict(
    [
      candidate("source-new", "US", "2026-08-10T00:00:00Z"),
      candidate("action-new", "US", null, "2026-08-12T00:00:00Z"),
      candidate("action-old", "US", null, "2026-08-11T00:00:00Z"),
    ],
    2,
  );

  assert.deepEqual(
    evicted.map((row) => row.id),
    ["action-old"],
  );
});

void test("malformed state identities never enter the federal bucket", () => {
  const malformed = {
    ...candidate("broken", "CA", "2026-08-10T00:00:00Z"),
    billNumber: "not a state identity",
  };
  assert.equal(retentionJurisdiction(malformed), "STATE");
});

void test("the retention limit must be positive", () => {
  assert.throws(() => selectBillsToEvict([], 0), /positive integer/);
});
