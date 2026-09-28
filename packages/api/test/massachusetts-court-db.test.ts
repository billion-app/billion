import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "@acme/db";
import { Bill, CourtCase } from "@acme/db/schema";

void test(
  "Massachusetts bills and court records share Browse while court search and detail stay scoped",
  { skip: !process.env.SCOTUS_TEST_POSTGRES_URL },
  async () => {
    const url = process.env.SCOTUS_TEST_POSTGRES_URL;
    assert.ok(url);
    const database = new URL(url);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(database.hostname));
    assert.match(database.pathname, /_test$/);
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { createCaller } = await import("../src/root.js");
    const api = createCaller({ db, session: null, authApi: {} as never });
    const id = randomUUID();
    const billId = randomUUID();
    try {
      await db.insert(Bill).values({
        id: billId,
        billNumber: `MA H 1234 (194th)`,
        title: `Test Massachusetts bill ${billId}`,
        sourceWebsite: "openstates.org",
        url: `https://openstates.org/ma/bills/194th/H1234/`,
        lastActionAt: new Date("2026-09-15T12:00:00Z"),
      });
      await db.insert(CourtCase).values({
        id,
        caseNumber: `TEST-MA-${id}`,
        title: "Commonwealth vs. Peters, Braden E (Clavicular)",
        court: "Orleans District Court",
        status: "Pending",
        filedDate: new Date("2026-09-08T12:00:00Z"),
        description: "Pending criminal case; charges are allegations.",
        fullText: "Charges (allegations, not findings): Test docket entry.",
        url: `https://ecourtrecords.org/us/massachusetts/barnstable-county/orleans/test/${id}/`,
      });
      const mixed = await api.content.getByType({
        type: "all",
        jurisdiction: "ma",
        limit: 20,
      });
      assert.ok(
        mixed.items.some(
          (item) => item.id === id && item.type === "court_case",
        ),
      );
      await assert.rejects(
        api.content.getById({ id: billId }),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "NOT_FOUND",
      );
      const billDetail = await api.content.getById({
        id: billId,
        supportsMassachusetts: true,
      });
      assert.equal(billDetail.type, "bill");
      assert.equal(billDetail.jurisdiction, "ma");
      assert.ok(
        mixed.items.some(
          (item) =>
            item.id === billId &&
            item.type === "bill" &&
            item.jurisdictionCode === "MA",
        ),
      );
      const local = await api.content.getByType({
        type: "court_case",
        jurisdiction: "ma",
        limit: 20,
      });
      assert.ok(
        local.items.some(
          (item) => item.id === id && item.jurisdictionCode === "MA",
        ),
      );
      const federal = await api.content.getByType({
        type: "court_case",
        jurisdiction: "federal",
        limit: 20,
      });
      assert.ok(!federal.items.some((item) => item.id === id));
      const matches = await api.content.search({
        query: "Clavicular",
        jurisdiction: "ma",
        type: "court_case",
      });
      assert.ok(matches.some((item) => item.id === id));
      const detail = await api.content.getById({ id });
      assert.equal(detail.type, "court_case");
      assert.equal(detail.jurisdictionCode, "MA");
      assert.equal(
        detail.originalContent,
        "Charges (allegations, not findings): Test docket entry.",
      );
    } finally {
      await db.delete(CourtCase).where(eq(CourtCase.id, id));
      await db.delete(Bill).where(eq(Bill.id, billId));
    }
  },
);
