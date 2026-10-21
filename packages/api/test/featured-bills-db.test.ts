import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { inArray } from "@acme/db";
import { Bill, BillInterest, FeaturedBill } from "@acme/db/schema";

import { rankFeaturedBillCandidates } from "../src/lib/featured-bills";

void test(
  "Featured ranks in Postgres and preserves editorial exclusions",
  {
    skip: !process.env.CONTENT_PROJECTION_TEST_DATABASE_URL,
  },
  async (t) => {
    const url = process.env.CONTENT_PROJECTION_TEST_DATABASE_URL;
    assert.ok(url);
    const target = new URL(url);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.match(target.pathname, /_test$/);
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { contentRouter } = await import("../src/router/content");
    const { createTRPCRouter } = await import("../src/trpc");
    const api = createTRPCRouter(contentRouter).createCaller({
      db,
      session: null,
      authApi: {} as never,
    });
    const now = new Date();
    const old = new Date(now.getTime() - 100 * 86_400_000);
    const candidates = Array.from({ length: 80 }, (_, i) => ({
      id: randomUUID(),
      interestScore: i < 3 ? 59 : 60 + (i % 41),
      controversyScore: i % 101,
      attentionScore: (i * 7) % 101,
      activityAt: i % 3 === 0 ? old : now,
    }));
    const overrides = Array.from({ length: 10 }, () => randomUUID());
    const stateId = randomUUID();
    const staleId = randomUUID();
    const enactedId = randomUUID();
    const ids = [
      ...candidates.map((c) => c.id),
      ...overrides,
      stateId,
      staleId,
      enactedId,
    ];
    const expected = rankFeaturedBillCandidates(candidates, now)
      .slice(0, 6)
      .map((c) => c.id);
    try {
      await db.insert(Bill).values(
        ids.map((id) => ({
          id,
          billNumber: id === stateId ? `CA AB ${id}` : `H.R. ${id}`,
          title: `Featured fixture ${id}`,
          description: "Fixture description",
          sourceWebsite: id === stateId ? "openstates.org" : "congress.gov",
          url: `https://example.org/${id}`,
          contentHash: "current",
          introducedDate: now,
          lastActionAt: candidates.find((c) => c.id === id)?.activityAt ?? now,
          actions:
            id === enactedId
              ? [{ date: old.toISOString(), text: "Became Public Law" }]
              : [],
        })),
      );
      await db.insert(BillInterest).values(
        ids.map((id) => ({
          billId: id,
          contentHash: id === staleId ? "old" : "current",
          interestScore:
            candidates.find((c) => c.id === id)?.interestScore ?? 100,
          controversyScore:
            candidates.find((c) => c.id === id)?.controversyScore ?? 100,
          attentionScore:
            candidates.find((c) => c.id === id)?.attentionScore ?? 100,
          reason: "Fixture",
          modelVersion: "test",
        })),
      );
      await db
        .insert(FeaturedBill)
        .values(overrides.map((billId) => ({ billId, active: false })));
      await t.test(
        "automatic winners match the prior ranking, excluding stale and old enacted bills",
        async () => {
          const actual = await api.getFeaturedBills({
            jurisdiction: "federal",
          });
          assert.deepEqual(
            actual.map((c) => c.id),
            expected,
          );
          assert.equal(actual.length, 6);
        },
      );
      await t.test(
        "live pins precede automatic winners and expired or future pins remain suppressed",
        async () => {
          const first = overrides[0];
          const second = overrides[1];
          const expired = overrides[2];
          const future = overrides[3];
          assert.ok(first && second && expired && future);
          await db
            .update(FeaturedBill)
            .set({ active: true })
            .where(
              inArray(FeaturedBill.billId, [first, second, expired, future]),
            );
          await db
            .update(FeaturedBill)
            .set({ displayOrder: -2, rationale: "Pinned first" })
            .where(inArray(FeaturedBill.billId, [first]));
          await db
            .update(FeaturedBill)
            .set({ displayOrder: -1 })
            .where(inArray(FeaturedBill.billId, [second]));
          await db
            .update(FeaturedBill)
            .set({ endsAt: old })
            .where(inArray(FeaturedBill.billId, [expired]));
          await db
            .update(FeaturedBill)
            .set({ startsAt: new Date(now.getTime() + 86_400_000) })
            .where(inArray(FeaturedBill.billId, [future]));
          const actual = await api.getFeaturedBills({
            jurisdiction: "federal",
          });
          assert.deepEqual(
            actual.map((c) => c.id),
            [first, second, ...expected.slice(0, 4)],
          );
          assert.equal(actual[0]?.featureTakeaway, "Pinned first");
        },
      );
      await t.test(
        "more than six live pins fills the row without automatic candidates",
        async () => {
          await db
            .update(FeaturedBill)
            .set({ active: true, startsAt: null, endsAt: null })
            .where(inArray(FeaturedBill.billId, overrides));
          const actual = await api.getFeaturedBills({
            jurisdiction: "federal",
          });
          assert.equal(actual.length, 6);
          assert.ok(actual.every((c) => overrides.some((id) => id === c.id)));
          assert.deepEqual(
            actual.map((c) => c.featuredPosition),
            [1, 2, 3, 4, 5, 6],
          );
        },
      );
    } finally {
      await db.delete(FeaturedBill).where(inArray(FeaturedBill.billId, ids));
      await db.delete(BillInterest).where(inArray(BillInterest.billId, ids));
      await db.delete(Bill).where(inArray(Bill.id, ids));
      await (db as typeof db & { $client: Pool }).$client.end();
    }
  },
);
