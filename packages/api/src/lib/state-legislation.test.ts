import assert from "node:assert/strict";
import test from "node:test";

import { stateBillMetadata } from "./state-legislation";

void test("derives state metadata from shared bill actions and versions", () => {
  assert.deepEqual(
    stateBillMetadata(
      [
        {
          date: "2026-02-01",
          text: "Committee hearing: Public Safety",
          type: "committee",
        },
        { date: "2026-02-02", text: "Referred: Rules - Legislative(H)" },
        {
          date: "2026-08-28",
          text: "Proposed effective date",
          type: "effective_date",
        },
      ],
      [
        {
          hash: "07-22-2026 10:30:48.253",
          updatedAt: "2026-07-22T10:30:48.253Z",
          changes: "complete_house_export",
        },
      ],
    ),
    {
      committees: ["Public Safety", "Rules - Legislative"],
      effectiveDate: "2026-08-28",
      sourceVersion: "07-22-2026 10:30:48.253",
      sourceUpdatedAt: "2026-07-22T10:30:48.253Z",
      sourceCoverage: "complete_house_export",
    },
  );
});
