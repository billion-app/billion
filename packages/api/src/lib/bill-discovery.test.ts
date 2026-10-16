import assert from "node:assert/strict";
import test from "node:test";

import { sql } from "@acme/db";
import { db } from "@acme/db/client";

import { billDiscoveryCondition } from "./bill-discovery";

// Read-only SQL fixtures exercise the production predicate without modifying
// stored bills. Opt in with a database URL; the test creates no schema or rows.
void test(
  "bill discovery expires enactments, not procedural updates",
  {
    skip: !process.env.BILL_DISCOVERY_TEST_DATABASE_URL,
  },
  async () => {
    process.env.POSTGRES_URL = process.env.BILL_DISCOVERY_TEST_DATABASE_URL;
    for (const [name, actions, status, expected] of [
      ["proposal", [], "Introduced", true],
      [
        "old law with fresh update",
        [
          { date: "2020-01-01", text: "Signed by Governor" },
          { date: new Date().toISOString(), text: "Chapter correction" },
        ],
        "Chapter correction",
        false,
      ],
      [
        "recent signature",
        [{ date: new Date().toISOString(), type: "executive-signature" }],
        "Approved",
        true,
      ],
      [
        "classification",
        [{ date: "2020-01-01", classification: ["became-law"] }],
        "Approved",
        false,
      ],
      ["unknown enactment date", [{ text: "Became law" }], "Became law", false],
      ["passage alone", [], "Passed", true],
    ] as const) {
      const result = await db.execute(sql`
      with bill as (select ${JSON.stringify(actions)}::jsonb as actions,
        ${status}::text as status, null::timestamp as last_action_at)
      select ${billDiscoveryCondition} as eligible from bill
    `);
      assert.equal(result.rows[0]?.eligible === true, expected, name);
    }
  },
);
