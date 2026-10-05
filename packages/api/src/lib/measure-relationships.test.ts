import assert from "node:assert/strict";
import test from "node:test";

import type { MeasureRelationship } from "@acme/validators";

import type { OfficialGuidePayload } from "./official-guide-cache";
import {
  publishedMeasureRelationships,
  relationshipEvidenceHash,
  relationshipHash,
} from "./measure-relationships";
import { propositionGuideHash } from "./proposition-consequences";

function required<T>(value: T | undefined): T {
  assert.ok(value);
  return value;
}

function fixture(numbers = ["70", "71"]): {
  guide: OfficialGuidePayload;
  draft: MeasureRelationship;
} {
  const guide: OfficialGuidePayload = {
    electionDate: "2026-11-03",
    jurisdiction: "CA",
    complete: true,
    fetchedAt: "2026-10-01T00:00:00Z",
    sourceUrl: "https://voterguide.sos.ca.gov/",
    candidates: [],
    measures: numbers.map((number) => ({
      number,
      title: `Synthetic ${number}`,
      sourceUrl: `https://voterguide.sos.ca.gov/propositions/${number}/`,
      fullTextUrl: `https://vig.cdn.sos.ca.gov/2026/general/pdf/prop${number}-text-proposed-laws.pdf`,
    })),
  };
  const sources = numbers.flatMap((number) =>
    (["legal-text", "official-analysis"] as const).map((role) => ({
      id: `${number}-${role}`,
      number,
      role,
      url:
        role === "legal-text"
          ? required(
              required(guide.measures.find((m) => m.number === number))
                .fullTextUrl,
            )
          : `https://voterguide.sos.ca.gov/propositions/${number}/analysis.htm`,
      locator: "Synthetic section",
      retrievedAt: guide.fetchedAt,
      snapshot: `Synthetic ${number} ${role}`,
      hash: relationshipHash(`Synthetic ${number} ${role}`),
      documentHash: relationshipHash(`Synthetic ${number} ${role}`),
    })),
  );
  const claim = {
    text: "Synthetic conditional outcome",
    sourceIds: sources.map((s) => s.id),
  };
  const draft: MeasureRelationship = {
    schemaVersion: 1,
    revision: `fixture-${numbers.join("-")}`,
    jurisdiction: "CA",
    electionDate: guide.electionDate,
    kind: "uncertain",
    measures: guide.measures.map((m) => ({
      number: m.number,
      title: m.title,
      url: m.sourceUrl,
      guideHash: propositionGuideHash(guide.electionDate, m),
    })) as MeasureRelationship["measures"],
    sources,
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
    review: { state: "pending" },
  };
  approve(draft);
  return { guide, draft };
}
function approve(draft: MeasureRelationship) {
  draft.review = {
    state: "approved",
    reviewer: "Synthetic editor",
    reviewedAt: "2026-10-02T00:00:00Z",
    revision: draft.revision,
    evidenceHash: relationshipEvidenceHash(draft),
    findings: "Test only",
  };
}
function publish(
  guide: OfficialGuidePayload,
  draft: MeasureRelationship,
  number = draft.measures[0].number,
) {
  return publishedMeasureRelationships(
    guide,
    number,
    draft.sources.map((s) => ({ url: s.url, hash: s.documentHash })),
    [draft],
  );
}
void test("same immutable relation appears on both readers, preserves cases and strips internal snapshots", () => {
  const { guide, draft } = fixture();
  for (const m of draft.measures) {
    const result = publish(guide, draft, m.number);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.scenarios.both.text, draft.scenarios.both.text);
    assert.ok(!("snapshot" in required(required(result[0]).sources[0])));
  }
  assert.deepEqual(publish(guide, draft, "42"), []);
});
void test("changed cycle, numbering, either guide revision and asymmetric coverage fail closed", () => {
  for (const mutation of [
    (g: OfficialGuidePayload) => {
      g.electionDate = "2024-11-05";
    },
    (g: OfficialGuidePayload) => {
      required(g.measures[0]).number = "42";
    },
    (g: OfficialGuidePayload) => {
      required(g.measures[1]).title = "Changed title";
    },
    (g: OfficialGuidePayload) => {
      required(g.measures[1]).officialSummary = "Changed source";
    },
    (g: OfficialGuidePayload) => {
      g.measures.pop();
    },
    (g: OfficialGuidePayload) => {
      g.measures.push(required(g.measures[0]));
    },
  ]) {
    const { guide, draft } = fixture();
    mutation(guide);
    assert.deepEqual(publish(guide, draft), []);
  }
});
void test("missing or changed legal/analysis capture and stale editorial approval fail closed", () => {
  const { guide, draft } = fixture();
  assert.deepEqual(
    publishedMeasureRelationships(guide, "70", draft.sources.slice(1), [draft]),
    [],
  );
  assert.deepEqual(
    publishedMeasureRelationships(
      guide,
      "70",
      draft.sources.map((s) => ({ url: s.url, hash: "b".repeat(64) })),
      [draft],
    ),
    [],
  );
  for (const mutation of [
    (d: MeasureRelationship) => {
      d.review.state = "pending";
    },
    (d: MeasureRelationship) => {
      d.scenarios.both.text = "Unsupported automatic cancellation";
    },
    (d: MeasureRelationship) => {
      required(d.sources[0]).snapshot = "Modified text";
    },
    (d: MeasureRelationship) => {
      d.takeaway.sourceIds = ["missing"];
      approve(d);
    },
    (d: MeasureRelationship) => {
      required(d.sources[0]).role = "official-analysis";
      approve(d);
    },
    (d: MeasureRelationship) => {
      required(d.sources[0]).retrievedAt = "2026-10-03T00:00:00Z";
      approve(d);
    },
  ]) {
    const f = fixture();
    mutation(f.draft);
    assert.deepEqual(publish(f.guide, f.draft), []);
  }
});
void test("multiple interactions render independent records with deduplicated pair revisions", () => {
  const first = fixture();
  const second = fixture(["70", "72"]);
  first.guide.measures.push(required(second.guide.measures[1]));
  const sources = [...first.draft.sources, ...second.draft.sources];
  const result = publishedMeasureRelationships(first.guide, "70", sources, [
    first.draft,
    first.draft,
    second.draft,
  ]);
  assert.equal(result.length, 2);
});

void test("captured pilot stays pending; reviewed copy must match all four document revisions", async () => {
  const { default: capture } =
    await import("./measure-relationship-revisions/ca-2026-pilot.json");
  const { measureRelationshipSchema } = await import("@acme/validators");
  const draft = measureRelationshipSchema.parse(capture.draft);
  const guide: OfficialGuidePayload = {
    electionDate: draft.electionDate,
    jurisdiction: "CA",
    complete: true,
    fetchedAt: "2026-10-05T00:00:00Z",
    sourceUrl: "https://voterguide.sos.ca.gov/",
    measures: capture.guideMeasures,
    candidates: [],
  };
  assert.deepEqual(publish(guide, draft), []);
  draft.review = {
    state: "approved",
    reviewer: "Synthetic test approval only",
    reviewedAt: "2026-10-06T00:00:00Z",
    revision: draft.revision,
    evidenceHash: relationshipEvidenceHash(draft),
    findings: "This approval exists only in memory, never the registry.",
  };
  assert.equal(
    publishedMeasureRelationships(
      guide,
      draft.measures[0].number,
      capture.relationshipSources,
      [draft],
    ).length,
    1,
  );
  assert.equal(
    publishedMeasureRelationships(
      guide,
      draft.measures[1].number,
      capture.relationshipSources,
      [draft],
    ).length,
    1,
  );
  assert.deepEqual(
    publishedMeasureRelationships(
      guide,
      draft.measures[0].number,
      draft.sources.slice(1).map((s) => ({ url: s.url, hash: s.documentHash })),
      [draft],
    ),
    [],
  );
});

void test("compact reader claims require evidence and renewed editorial approval", () => {
  for (const mutation of [
    (draft: MeasureRelationship) => {
      draft.compact = undefined;
      approve(draft);
    },
    (draft: MeasureRelationship) => {
      assert.ok(draft.compact);
      draft.compact.scenarios.both.consequence.text = "Changed consequence";
    },
    (draft: MeasureRelationship) => {
      assert.ok(draft.compact);
      draft.compact.measures[0].sourceIds = ["missing"];
      approve(draft);
    },
    (draft: MeasureRelationship) => {
      assert.ok(draft.compact);
      draft.compact.scenarios.neither.consequence.sourceIds = ["missing"];
      approve(draft);
    },
  ]) {
    const { guide, draft } = fixture();
    mutation(draft);
    assert.deepEqual(publish(guide, draft), []);
  }
});
