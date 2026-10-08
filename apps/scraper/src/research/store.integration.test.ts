import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ResearchCache, ResearchDocument } from "@acme/db/schema";

import { createResearchLibrary } from "./library.js";
import { createSharedResearch, researchKey } from "./shared.js";
import { hash, researchStore } from "./store.js";

const databaseUrl = process.env.RESEARCH_TEST_DATABASE_URL;
test(
  "real Postgres preserves evidence across instances, indexes documents, and retains source revisions",
  { skip: !databaseUrl },
  async (t) => {
    const target = new URL(databaseUrl!);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
    assert.match(target.pathname, /^\/billion_research.*_test$/);
    process.env.POSTGRES_URL = databaseUrl;
    const suffix = randomUUID();
    const input = {
      title: "Housing affordability safeguards",
      type: "bill",
      fullText:
        "Official housing affordability safeguards evidence for a proposed law.",
      sourceUrl: `https://fixture.gov/${suffix}`,
    };
    const secondary = `https://fixture.edu/${suffix}`;
    const originalSecondary =
      "Housing affordability safeguards have documented historical implementation tradeoffs.";
    const makeLibrary = () =>
      createResearchLibrary({
        store: researchStore,
        namespace: "integration",
        discover: async () => {
          throw new Error("Direct sources must not spend search credits");
        },
        retrieve: async (url) => ({
          url,
          title: "Housing affordability evidence",
          body: originalSecondary,
        }),
      });
    let runs = 0;
    const run: Parameters<typeof createSharedResearch>[0]["run"] = async (
      _input,
      tools,
    ) => {
      runs++;
      await tools.fetch_page.execute!({ url: secondary }, {} as never);
      return "Historical explanation and competing perspectives use the same verified evidence.";
    };
    t.after(async () => {
      await db
        .delete(ResearchCache)
        .where(eq(ResearchCache.key, researchKey(input)));
      await db
        .delete(ResearchDocument)
        .where(
          sql`${ResearchDocument.url} in (${input.sourceUrl}, ${secondary})`,
        );
      await (
        db as unknown as { $client: { end(): Promise<void> } }
      ).$client.end();
    });
    const packet = await createSharedResearch({
      store: researchStore,
      library: makeLibrary(),
      run,
    })(input);
    assert.equal(packet.sources.length, 2);
    const restarted = createSharedResearch({
      store: researchStore,
      library: makeLibrary(),
      run,
    });
    assert.deepEqual(await restarted(input), packet);
    assert.equal(runs, 1);
    const found = await researchStore.find("housing affordability safeguards");
    assert.ok(found.some((document) => document.url === secondary));
    await makeLibrary().seed(
      secondary,
      "Updated evidence",
      "Updated source text from the same publisher.",
    );
    const versions = await db
      .select()
      .from(ResearchDocument)
      .where(eq(ResearchDocument.url, secondary));
    assert.equal(versions.length, 2);
    assert.ok(
      versions.some(
        (document) =>
          document.sourceHash === hash(originalSecondary) &&
          document.body === originalSecondary,
      ),
    );
    assert.equal(
      (await researchStore.document(secondary))?.body,
      "Updated source text from the same publisher.",
    );
    const policies = await db.execute(
      sql`select relname, relrowsecurity from pg_class where relname in ('research_cache', 'research_document')`,
    );
    assert.ok(policies.rows.every((row) => row.relrowsecurity));
  },
);
