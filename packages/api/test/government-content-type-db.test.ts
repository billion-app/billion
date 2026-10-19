import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq, inArray } from "@acme/db";
import { GovernmentContent, SavedArticle } from "@acme/db/schema";

void test(
  "presidential document source types survive every content API projection",
  { skip: !process.env.GOVERNMENT_CONTENT_TEST_POSTGRES_URL },
  async (t) => {
    const url = process.env.GOVERNMENT_CONTENT_TEST_POSTGRES_URL;
    assert.ok(url);
    const database = new URL(url);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(database.hostname));
    assert.match(database.pathname, /_test$/);
    process.env.POSTGRES_URL = url;
    const { db } = await import("@acme/db/client");
    const { createTRPCRouter } = await import("../src/trpc");
    const { contentRouter } = await import("../src/router/content");
    const router = createTRPCRouter(contentRouter);
    const api = router.createCaller({
      db,
      session: null,
      authApi: {} as never,
    });
    const userId = randomUUID();
    const now = new Date();
    const authenticated = router.createCaller({
      db,
      authApi: {} as never,
      session: {
        user: {
          id: userId,
          name: "Fixture reader",
          email: `${userId}@example.org`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
        session: {
          id: randomUUID(),
          userId,
          token: randomUUID(),
          expiresAt: new Date(now.getTime() + 60_000),
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const query = `GovernmentSubtype${userId.replaceAll("-", "")}`;
    const fixtures = [
      "Notice",
      "Executive Order",
      "Memorandum",
      "Proclamation",
      "News Article",
      "Presidential Determination",
    ].map((type) => ({
      id: randomUUID(),
      title: `${query} ${type}`,
      type,
      publishedDate: now,
      fullText: `${type} source text`,
      url: `https://example.org/${randomUUID()}`,
    }));
    const ids = fixtures.map(({ id }) => id);
    const assertTypes = (
      items: readonly {
        id: string;
        type: string;
        governmentContentType?: string;
      }[],
    ) => {
      for (const fixture of fixtures) {
        const item = items.find(({ id }) => id === fixture.id);
        assert.ok(item, `${fixture.type} should be present`);
        assert.equal(item.type, "government_content");
        assert.equal(item.governmentContentType, fixture.type);
      }
    };
    try {
      await db.insert(GovernmentContent).values(fixtures);
      await db.insert(SavedArticle).values(
        ids.map((contentId) => ({
          userId,
          contentId,
          contentType: "government_content",
        })),
      );
      await t.test("getAll", async () => assertTypes(await api.getAll()));
      for (const type of ["all", "government_content", "general"] as const) {
        await t.test(`Browse ${type}`, async () => {
          assertTypes((await api.getByType({ type, limit: 50 })).items);
        });
        await t.test(`Search ${type}`, async () => {
          assertTypes(await api.search({ type, query, limit: 50 }));
        });
      }
      await t.test("byIds", async () => {
        assertTypes((await api.byIds({ ids })).items);
      });
      await t.test("saved", async () => {
        assertTypes((await authenticated.saved.list({ limit: 50 })).items);
      });
      await t.test("detail", async () => {
        for (const fixture of fixtures) {
          const detail = await api.getById({ id: fixture.id });
          assert.equal(detail.type, "government_content");
          assert.equal(detail.governmentContentType, fixture.type);
          assert.equal(detail.originalContent, fixture.fullText);
        }
      });
    } finally {
      await db.delete(SavedArticle).where(eq(SavedArticle.userId, userId));
      await db
        .delete(GovernmentContent)
        .where(inArray(GovernmentContent.id, ids));
    }
  },
);
