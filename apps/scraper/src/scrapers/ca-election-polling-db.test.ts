import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CA_POLLING_ENDPOINT,
  pollingCacheParams,
} from "@acme/api/lib/california-polling";
import { and, eq, inArray } from "@acme/db";
import { CivicApiCache } from "@acme/db/schema";

import { parsePpicPdf } from "./ca-election-polling-parser.js";
import { storeCaliforniaPollingReport } from "./ca-election-polling-store.js";

void test(
  "poll report upserts are idempotent, revise atomically and preserve other reports after invalid input",
  {
    skip: !process.env.POLLING_TEST_POSTGRES_URL || !process.env.PPIC_PDF_PATH,
  },
  async () => {
    const url = new URL(process.env.POLLING_TEST_POSTGRES_URL!);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
    assert.ok(url.pathname.endsWith("_test"));
    process.env.POSTGRES_URL = url.href;
    const { db } = await import("@acme/db/client");
    const fixtureId = `fixture-poll-${randomUUID()}`;
    const report = await parsePpicPdf(
      new Uint8Array(await readFile(process.env.PPIC_PDF_PATH!)),
      {
        reportId: fixtureId,
        sourceUrl:
          "https://www.ppic.org/wp-content/uploads/crosstabs-likely-voters-1026.pdf",
        publishedAt: "2026-10-27",
      },
      new Date("2026-10-29T12:00:00Z"),
    );
    const other = {
      ...report,
      reportId: `${fixtureId}-older`,
      fieldEnd: "2026-10-21",
    };
    const keys = [pollingCacheParams(report), pollingCacheParams(other)];
    const condition = and(
      eq(CivicApiCache.endpoint, CA_POLLING_ENDPOINT),
      inArray(CivicApiCache.params, keys),
    );
    const read = () => db.select().from(CivicApiCache).where(condition);
    try {
      await storeCaliforniaPollingReport(db, report);
      await storeCaliforniaPollingReport(db, report);
      assert.equal((await read()).length, 1);
      await storeCaliforniaPollingReport(db, other);
      const revised = {
        ...report,
        sourceHash: "b".repeat(64),
        observations: report.observations.slice(0, 1),
      };
      await storeCaliforniaPollingReport(db, revised);
      const rows = await read();
      assert.equal(rows.length, 2);
      assert.deepEqual(
        rows.find((row) => row.params === keys[0])?.responseData,
        revised,
      );
      assert.deepEqual(
        rows.find((row) => row.params === keys[1])?.responseData,
        other,
      );
      await assert.rejects(
        storeCaliforniaPollingReport(db, { ...report, observations: [] }),
      );
      assert.deepEqual(await read(), rows);
    } finally {
      await db.delete(CivicApiCache).where(condition);
    }
  },
);
