import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { OfficialGuidePayload } from "@acme/api/lib/official-guide-cache";
import type { MeasureRelationship } from "@acme/validators";
import {
  publishedMeasureRelationships,
  relationshipEvidenceHash,
} from "@acme/api/lib/measure-relationships";

import type { RelationshipCorpus } from "./measure-relationship-capture.js";
import { sourceHash } from "./measure-relationship-capture.js";
import {
  buildRelationshipPrompt,
  discoverMeasureRelationships,
  validateRelationshipCorpus,
} from "./measure-relationship-generation.js";
import { registerRelationshipRevisions } from "./measure-relationship-register.js";

function fixture(count = 3): RelationshipCorpus {
  const guide: OfficialGuidePayload = {
    electionDate: "2028-11-07",
    jurisdiction: "CA",
    complete: true,
    fetchedAt: "2028-10-01T00:00:00Z",
    sourceUrl: "https://voterguide.sos.ca.gov/",
    candidates: [],
    measures: Array.from({ length: count }, (_, i) => {
      const number = String(70 + i);
      return {
        number,
        title: `Future infrastructure measure ${number}`,
        sourceUrl: `https://voterguide.sos.ca.gov/propositions/${number}/`,
        fullTextUrl: `https://vig.cdn.sos.ca.gov/2028/prop${number}.pdf`,
      };
    }),
  };
  return {
    guide,
    sources: guide.measures.flatMap((m) =>
      (["legal-text", "official-analysis"] as const).map((role) => {
        const snapshot =
          role === "legal-text"
            ? `PROPOSITION ${m.number}\nSection 3: Infrastructure operation depends on the funding mechanism specified in this section.`
            : `Official analysis of ${m.number}, funding and implementation.`;
        return {
          id: `${role}-${m.number}`,
          number: m.number,
          role,
          url:
            role === "legal-text"
              ? m.fullTextUrl!
              : `${m.sourceUrl}analysis.htm`,
          locator: role === "legal-text" ? "Section 3" : "Official analysis",
          retrievedAt: guide.fetchedAt,
          snapshot,
          hash: sourceHash(snapshot),
          documentHash: sourceHash(`original ${role} ${m.number}`),
        };
      }),
    ),
  };
}
function authored(corpus: RelationshipCorpus, pair: string[]) {
  const sources = corpus.sources.filter((s) => pair.includes(s.number));
  const claim = {
    text: "A source-supported infrastructure dependency.",
    sourceIds: sources.map((s) => s.id),
  };
  return {
    kind: "dependency",
    takeaway: claim,
    affectedProvisions: [claim],
    scenarios: {
      neither: claim,
      onlyFirst: claim,
      onlySecond: claim,
      both: claim,
    },
    conditions: [claim],
    compact: {
      measures: [claim, claim],
      takeaway: claim,
      scenarios: {
        neither: { title: claim, consequence: claim },
        onlyFirst: { title: claim, consequence: claim },
        onlySecond: { title: claim, consequence: claim },
        both: { title: claim, consequence: claim },
      },
      provisions: [claim, claim],
    },
    warrants: sources
      .filter((s) => s.role === "legal-text")
      .map((s) => ({
        sourceId: s.id,
        quote: s.snapshot,
        locator: "Section 3",
      })),
  };
}
const options = {
  model: "offline-test",
  maxPairs: 10,
  maxModelCalls: 10,
  maxPromptChars: 200000,
};
function approve(draft: MeasureRelationship) {
  draft.review = {
    state: "approved",
    reviewer: "Test only",
    reviewedAt: "2028-10-02T00:00:00Z",
    revision: draft.revision,
    evidenceHash: relationshipEvidenceHash(draft),
    findings: "Synthetic review exists only in temporary test files.",
  };
}

void test("future election: evaluates all pairs, emits only material relationship, reuses positive and negative assessments", async () => {
  const corpus = fixture();
  let calls = 0;
  const result = await discoverMeasureRelationships(corpus, {
    ...options,
    assess: async (prompt) => {
      calls++;
      assert.ok(prompt.includes("Return relationship=null"));
      const sources = JSON.parse(prompt.split("SOURCE DOCUMENTS:\n")[1]!);
      const pair = [
        ...new Set(sources.map((s: { number: string }) => s.number)),
      ] as string[];
      return {
        reason: "Offline classification",
        relationship: pair.join() === "70,71" ? authored(corpus, pair) : null,
      };
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.complete, true);
  assert.deepEqual(
    result.assessments.map((r) => r.pair),
    [
      ["70", "71"],
      ["70", "72"],
      ["71", "72"],
    ],
  );
  assert.equal(result.assessments.filter((r) => r.draft).length, 1);
  const draft = result.assessments[0]!.draft!;
  assert.equal(draft.review.state, "pending");
  assert.equal(draft.electionDate, "2028-11-07");
  assert.equal(draft.compact!.bothPassComparisons, undefined);
  const hashes = corpus.sources.map((s) => ({
    url: s.url,
    hash: s.documentHash,
  }));
  assert.deepEqual(
    publishedMeasureRelationships(corpus.guide, "70", hashes, [draft]),
    [],
  );
  approve(draft);
  assert.equal(
    publishedMeasureRelationships(corpus.guide, "70", hashes, [draft]).length,
    1,
  );
  assert.equal(
    publishedMeasureRelationships(corpus.guide, "71", hashes, [draft]).length,
    1,
  );
  assert.deepEqual(
    publishedMeasureRelationships(corpus.guide, "72", hashes, [draft]),
    [],
  );
  draft.review = { state: "pending" };
  const recaptured = structuredClone(corpus);
  recaptured.sources.forEach((s) => (s.retrievedAt = "2028-10-02T00:00:00Z"));
  const reused = await discoverMeasureRelationships(recaptured, {
    ...options,
    maxModelCalls: 0,
    previous: result.assessments,
    assess: async () => {
      throw new Error("Must reuse");
    },
  });
  assert.equal(reused.assessments.length, 3);
});

void test("unrelated election and single-measure election produce no relationship drafts", async () => {
  for (const count of [1, 3]) {
    let calls = 0;
    const result = await discoverMeasureRelationships(fixture(count), {
      ...options,
      assess: async () => {
        calls++;
        return {
          reason: "No material interaction supported",
          relationship: null,
        };
      },
    });
    assert.equal(calls, count === 1 ? 0 : 3);
    assert.ok(result.assessments.every((r) => !r.draft));
  }
});

void test("budgets and incomplete evidence stop before model calls; unsupported quotations/citations reject drafts", async () => {
  const corpus = fixture();
  let calls = 0;
  const assess = async () => {
    calls++;
    return { reason: "Fixture", relationship: authored(corpus, ["70", "71"]) };
  };
  for (const override of [
    { maxPairs: 2 },
    { maxModelCalls: 2 },
    { maxPromptChars: 10 },
  ])
    await assert.rejects(
      discoverMeasureRelationships(corpus, { ...options, ...override, assess }),
    );
  assert.equal(calls, 0);
  const incomplete = structuredClone(corpus);
  incomplete.sources.pop();
  assert.throws(() => validateRelationshipCorpus(incomplete));
  const changed = structuredClone(corpus);
  changed.sources[0]!.snapshot += "changed";
  assert.throws(() => validateRelationshipCorpus(changed));
  for (const mutation of [
    (value: ReturnType<typeof authored>) => {
      value.warrants[0]!.quote = "Fabricated provision";
    },
    (value: ReturnType<typeof authored>) => {
      value.warrants[1]!.sourceId = value.warrants[0]!.sourceId;
    },
    (value: ReturnType<typeof authored>) => {
      value.compact.takeaway.sourceIds = ["unknown"];
    },
  ]) {
    const value = authored(corpus, ["70", "71"]);
    mutation(value);
    await assert.rejects(
      discoverMeasureRelationships(fixture(2), {
        ...options,
        assess: async () => ({
          reason: "Invalid fixture",
          relationship: value,
        }),
      }),
    );
  }
});

void test("multiple related neighbors register without manual imports; pending/changed records cannot register", async () => {
  const corpus = fixture();
  const result = await discoverMeasureRelationships(corpus, {
    ...options,
    assess: async (prompt) => {
      const sources = JSON.parse(prompt.split("SOURCE DOCUMENTS:\n")[1]!);
      const pair = [
        ...new Set(sources.map((s: { number: string }) => s.number)),
      ] as string[];
      return {
        reason: "Test dependency",
        relationship: authored(corpus, pair),
      };
    },
  });
  const directory = await mkdtemp(
    join(tmpdir(), "billion-relationships-test-"),
  );
  try {
    const drafts = result.assessments.map((r) => r.draft!);
    await assert.rejects(
      registerRelationshipRevisions(corpus, drafts, directory),
    );
    assert.deepEqual(await readdir(directory), []);
    drafts.forEach(approve);
    assert.equal(
      await registerRelationshipRevisions(corpus, drafts, directory),
      3,
    );
    const registry = await readFile(join(directory, "registry.ts"), "utf8");
    assert.equal((registry.match(/import revision/g) ?? []).length, 3);
    assert.equal(
      await registerRelationshipRevisions(corpus, drafts, directory),
      3,
    );
    const hashes = corpus.sources.map((s) => ({
      url: s.url,
      hash: s.documentHash,
    }));
    assert.equal(
      publishedMeasureRelationships(corpus.guide, "71", hashes, drafts).length,
      2,
    );
    const altered = structuredClone(drafts[0]!);
    altered.compact!.takeaway.text = "Changed after approval";
    await assert.rejects(
      registerRelationshipRevisions(corpus, [altered], directory),
    );
    const badWarrant = structuredClone(drafts[0]!);
    badWarrant.generation!.warrants[0]!.quote = "Invented";
    approve(badWarrant);
    assert.deepEqual(
      publishedMeasureRelationships(corpus.guide, "70", hashes, [badWarrant]),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("relationship prompt contains the entire supplied evidence without an authored pair or topic hint", () => {
  const corpus = fixture();
  const prompt = buildRelationshipPrompt(corpus, ["70", "72"]);
  for (const source of corpus.sources.filter((s) => s.number !== "71"))
    assert.ok(prompt.includes(JSON.stringify(source.snapshot)));
  assert.ok(!prompt.includes("wealth tax"));
});

void test("interrupted changed-source rerun preserves unchanged later negative assessments", async () => {
  const initial = fixture();
  const previous = await discoverMeasureRelationships(initial, {
    ...options,
    assess: async () => ({
      reason: "No material interaction",
      relationship: null,
    }),
  });
  const changed = structuredClone(initial);
  changed.sources[0]!.snapshot += " Updated funding provision.";
  changed.sources[0]!.hash = sourceHash(changed.sources[0]!.snapshot);
  changed.sources[0]!.documentHash = sourceHash("changed original document");
  let persisted = previous.assessments;
  let calls = 0;
  await assert.rejects(
    discoverMeasureRelationships(changed, {
      ...options,
      maxModelCalls: 2,
      previous: previous.assessments,
      assess: async () => {
        if (++calls === 2) throw new Error("Simulated interruption");
        return { reason: "No material interaction", relationship: null };
      },
      onAssessment: async (records) => {
        persisted = structuredClone(records);
      },
    }),
    /Simulated interruption/,
  );
  assert.deepEqual(
    persisted.map((r) => r.pair),
    [
      ["70", "71"],
      ["71", "72"],
    ],
  );
  calls = 0;
  const resumed = await discoverMeasureRelationships(changed, {
    ...options,
    maxModelCalls: 1,
    previous: persisted,
    assess: async () => {
      calls++;
      return { reason: "No interaction", relationship: null };
    },
  });
  assert.equal(calls, 1);
  assert.equal(resumed.assessments.length, 3);
});
