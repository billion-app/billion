import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { inArray } from "@acme/db";
import { Bill, CourtCase, GovernmentContent } from "@acme/db/schema";

void test(
  "content projections retain card metadata, search matches, and reader source text",
  { skip: !process.env.CONTENT_PROJECTION_TEST_DATABASE_URL },
  async (t) => {
    const databaseUrl = process.env.CONTENT_PROJECTION_TEST_DATABASE_URL;
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.match(target.pathname, /_test$/);
    process.env.POSTGRES_URL = target.toString();
    const { db } = await import("@acme/db/client");
    const { createTRPCRouter } = await import("../src/trpc");
    const { contentRouter, toBillCard } = await import("../src/router/content");
    const { loadContentDetail } = await import("../src/lib/content-detail");
    const { hashReaderSource, readerTranslationSource } =
      await import("../src/lib/content-translation");
    const api = createTRPCRouter(contentRouter).createCaller({
      db,
      session: null,
      authApi: {} as never,
    });
    const id = randomUUID();
    const searchTerm = `egress${id.replaceAll("-", "")}`;
    const fullText = `Official source contains ${searchTerm}. `.repeat(400);
    const now = new Date();
    const bills = [
      {
        id: randomUUID(),
        title: "Federal example",
        billNumber: `H.R. ${id}`,
        sourceWebsite: "congress.gov",
        description: "A concise federal card",
        summary: "A longer summary is not the description",
        sponsor: null,
        chamber: "House",
        introducedDate: new Date("2026-01-01T00:00:00Z"),
        lastActionAt: now,
        status: "Referred to the Committee on Rules",
        actions: [{ date: "2026-01-01", text: "Introduced in House" }],
        thumbnailUrl: "https://example.org/federal.png",
        fullText,
        aiGeneratedArticle: "An authored federal explainer",
        url: `https://example.org/bill/${id}`,
      },
      {
        id: randomUUID(),
        title: "State example",
        billNumber: `CA AB 123 (${id})`,
        sourceWebsite: "openstates.org",
        description: null,
        summary: "The state card falls back to its summary",
        sponsor: "Example Sponsor",
        chamber: "lower",
        introducedDate: now,
        lastActionAt: null,
        status: "Introduced",
        actions: [],
        thumbnailUrl: null,
        fullText,
        aiGeneratedArticle: null,
        url: `https://example.org/state/${id}`,
      },
    ];
    const government = {
      id: randomUUID(),
      title: "Presidential example",
      type: "Memorandum",
      publishedDate: now,
      source: "federalregister.gov",
      description: "A memorandum card",
      thumbnailUrl: "https://example.org/memorandum.png",
      fullText,
      aiGeneratedArticle: "An authored presidential explainer",
      url: `https://example.org/government/${id}`,
      federalRegisterUrl: `https://example.org/register/${id}`,
    };
    const courtCase = {
      id: randomUUID(),
      caseNumber: id,
      court: "Supreme Court",
      title: "Court example",
      filedDate: now,
      description: "A court card",
      fullText,
      aiGeneratedArticle: null,
      url: `https://www.supremecourt.gov/opinions/${id}`,
    };
    const billIds = bills.map((bill) => bill.id);
    try {
      const storedBills = await db.insert(Bill).values(bills).returning();
      await db.insert(GovernmentContent).values(government);
      await db.insert(CourtCase).values(courtCase);

      await t.test(
        "bill card fields survive typed Browse, search, and getAll",
        async () => {
          const all = await api.getAll();
          for (const bill of storedBills) {
            const expected = toBillCard(bill);
            const jurisdiction =
              bill.sourceWebsite === "openstates.org" ? "ca" : "federal";
            const browse = await api.getByType({
              type: "bill",
              jurisdiction,
              limit: 1,
            });
            const search = await api.search({
              type: "bill",
              jurisdiction,
              query: searchTerm,
            });
            for (const items of [all, browse.items, search]) {
              const card = items.find((item) => item.id === bill.id);
              assert.ok(card);
              for (const [key, value] of Object.entries(expected)) {
                assert.deepEqual(Reflect.get(card, key), value, key);
              }
              assert.equal("fullText" in card, false);
              assert.equal("searchVector" in card, false);
            }
          }
        },
      );

      await t.test(
        "presidential and court cards remain searchable by original text",
        async () => {
          for (const fixture of [
            { record: government, type: "government_content" },
            { record: courtCase, type: "court_case" },
          ] as const) {
            const browse = await api.getByType({
              type: fixture.type,
              limit: 1,
            });
            const search = await api.search({
              type: fixture.type,
              query: searchTerm,
            });
            const all = await api.getAll();
            for (const items of [browse.items, search, all]) {
              const card = items.find((item) => item.id === fixture.record.id);
              assert.ok(card);
              assert.equal(card.title, fixture.record.title);
              assert.equal(card.description, fixture.record.description);
              assert.equal(card.type, fixture.type);
              assert.equal("fullText" in card, false);
            }
            assert.equal(
              search[0]?.governmentContentType,
              fixture.type === "government_content" ? "Memorandum" : undefined,
            );
          }
        },
      );

      await t.test(
        "detail preserves authored prose, source fallback, and translation hashes",
        async () => {
          for (const record of [...bills, government, courtCase]) {
            const detail = await api.getById({ id: record.id });
            assert.equal(detail.originalContent, fullText);
            assert.equal(
              detail.articleContent,
              record.aiGeneratedArticle ?? fullText,
            );
            assert.equal(detail.url, record.url);
            const translation = await loadContentDetail({
              id: record.id,
              translationOnly: true,
            });
            assert.equal(
              hashReaderSource(readerTranslationSource(translation)),
              detail.translationSourceHash,
            );
          }
          const detail = await api.getById({ id: government.id });
          assert.equal(
            "officialUrl" in detail ? detail.officialUrl : undefined,
            government.federalRegisterUrl,
          );
        },
      );

      await t.test(
        "sponsor lookup retains source link and related cards",
        async () => {
          const stateBill = bills[1];
          assert.ok(stateBill);
          const profile = await api.getSponsorProfile({ billId: stateBill.id });
          assert.ok(profile);
          assert.equal(profile.sourceUrl, stateBill.url);
          assert.equal(profile.jurisdiction, "ca");
          assert.equal(profile.sponsoredBills[0]?.id, stateBill.id);
          assert.equal(
            profile.sponsoredBills[0].description,
            stateBill.summary,
          );
        },
      );
    } finally {
      await db.delete(Bill).where(inArray(Bill.id, billIds));
      await db
        .delete(GovernmentContent)
        .where(inArray(GovernmentContent.id, [government.id]));
      await db.delete(CourtCase).where(inArray(CourtCase.id, [courtCase.id]));
    }
  },
);
