import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import pg from "pg";

import { generateCourtBrief } from "../utils/ai/court-brief.js";
import {
  emergency,
  emergencyOutput,
  fixtureModel,
} from "../utils/ai/fixtures/court-brief-fixtures.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";

void test(
  "source → real generation/validation → stored court brief → tRPC, with cache and fallback regressions",
  { skip: !process.env.SCOTUS_TEST_POSTGRES_URL },
  async () => {
    const url = process.env.SCOTUS_TEST_POSTGRES_URL!;
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
      "Court fixture writes require a local database",
    );
    process.env.POSTGRES_URL = url;
    process.env.SCRAPER_SKIP_DUAL_LENS = "1";
    const { upsertContent, upsertCourtBrief } =
      await import("../utils/db/operations.js");
    const { db } = await import("@acme/db/client");
    const { createCaller } = await import("@acme/api");
    const api = createCaller({ db, session: null, authApi: {} as never });
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const id = randomUUID();
    const data = { ...emergency.data };
    const input = { type: "court_case" as const, data };
    const model = fixtureModel([
      emergencyOutput,
      emergencyOutput,
      emergencyOutput,
    ]);
    const generator = (args: Parameters<typeof generateCourtBrief>[0]) =>
      generateCourtBrief(args, model);
    const artifact = (name: string, detail: unknown) => {
      if (process.env.COURT_BRIEF_TEST_ARTIFACT_DIR)
        writeFileSync(
          join(process.env.COURT_BRIEF_TEST_ARTIFACT_DIR, `${name}.json`),
          JSON.stringify(detail),
        );
    };
    try {
      const { rows: existing } = await client.query(
        "select id from court_case where case_number=$1 and court=$2",
        [data.caseNumber, data.court],
      );
      assert.equal(
        existing.length,
        0,
        "Use an empty fixture database; this test will not modify an existing 26A305 row",
      );
      const newInput = {
        ...input,
        data: { ...data, caseNumber: `TEST-NEW-${id}` },
      };
      assert.deepEqual(
        await upsertContent(newInput, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "deferred", reason: "run budget reached" },
      );
      assert.deepEqual(
        await upsertContent(newInput, {
          newItemLimiter: createNewItemLimiter(1),
          courtBriefGenerator: async () => null,
        }),
        { status: "deferred", reason: "enrichment did not complete" },
      );
      const { rows: partialRows } = await client.query(
        "select id from court_case where case_number=$1",
        [newInput.data.caseNumber],
      );
      assert.equal(partialRows.length, 0);
      assert.deepEqual(
        await upsertContent({
          ...newInput,
          data: { ...newInput.data, fullText: null },
        }),
        { status: "deferred", reason: "court source text unavailable" },
      );
      await client.query(
        `insert into court_case (id, case_number, title, court, description, ai_generated_article, full_text, url, thumbnail_url, content_hash)
      values ($1,$2,$3,$4,'Legacy summary','Legacy Markdown explanation',$5,$6,'https://example.org/existing.png','old')`,
        [id, data.caseNumber, data.title, data.court, data.fullText, data.url],
      );
      const missing = await api.content.getById({ id });
      assert.equal(missing.type, "court_case");
      assert.equal("brief" in missing, false);
      assert.equal(missing.type === "court_case" && missing.courtBrief, null);
      assert.equal(missing.articleContent, "Legacy Markdown explanation");
      artifact("missing", missing);

      const limiter = createNewItemLimiter(1);
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: limiter,
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 1);
      const { rows: stored } = await client.query(
        "select content_hash, brief from content_brief where content_id=$1 and content_type='court_case'",
        [id],
      );
      assert.equal(stored.length, 1);
      assert.equal(stored[0].brief.sourceHash, stored[0].content_hash);
      const detail = await api.content.getById({ id });
      assert.ok(detail.type === "court_case" && detail.courtBrief);
      assert.equal(detail.courtBrief.action.text, emergencyOutput.action.text);
      assert.equal(detail.courtBrief.proceeding, "emergency_order");
      assert.equal(detail.originalContent, data.fullText);
      assert.equal(detail.articleContent, data.fullText);
      assert.equal(detail.description, emergencyOutput.takeaway.text);
      assert.equal(detail.isAIGenerated, true);
      assert.equal(detail.courtBrief.verifiedQuotes, 1);
      artifact("valid", detail);
      // No article or summary generator is injected. Any redundant call would fail
      // without provider credentials; exactly one structured-model call occurred.
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 1);

      await client.query(
        "update content_brief set brief=jsonb_set(brief,'{generatorVersion}','\"old\"') where content_id=$1",
        [id],
      );
      const invalid = await api.content.getById({ id });
      assert.equal(invalid.type === "court_case" && invalid.courtBrief, null);
      artifact("invalid", invalid);
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "deferred", reason: "run budget reached" },
      );
      assert.deepEqual(
        await upsertContent(input, {
          newItemLimiter: createNewItemLimiter(1),
          courtBriefGenerator: generator,
        }),
        { status: "written", id },
      );
      assert.equal(model.doGenerateCalls.length, 2);

      const changed = {
        ...input,
        data: {
          ...data,
          fullText: `${data.fullText}\nRevision fixture: the merits remain unresolved.`,
        },
      };
      assert.deepEqual(
        await upsertContent(changed, {
          newItemLimiter: createNewItemLimiter(0),
          courtBriefGenerator: generator,
        }),
        { status: "deferred", reason: "run budget reached" },
      );
      const stale = await api.content.getById({ id });
      assert.equal(stale.type === "court_case" && stale.courtBrief, null);
      assert.equal(stale.articleContent, changed.data.fullText);
      assert.equal(stale.isAIGenerated, false);
      artifact("stale", stale);
      const { rows: hashes } = await client.query(
        "select content_hash from court_case where id=$1",
        [id],
      );
      const args = {
        contentId: id,
        contentHash: hashes[0].content_hash as string,
        data: changed.data,
      };
      assert.equal(await upsertCourtBrief(args, async () => null), false);
      assert.equal(await upsertCourtBrief(args, generator), true);
      assert.equal(model.doGenerateCalls.length, 3);
      const refreshed = await api.content.getById({ id });
      assert.ok(refreshed.type === "court_case" && refreshed.courtBrief);
    } finally {
      await client.query(
        "delete from content_brief where content_id=$1 and content_type='court_case'",
        [id],
      );
      await client.query("delete from court_case where id=$1", [id]);
      await client.end();
      await (db as unknown as { $client: pg.Pool }).$client.end();
    }
  },
);
