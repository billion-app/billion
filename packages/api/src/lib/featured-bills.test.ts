import assert from "node:assert/strict";
import test from "node:test";

import {
  featuredBillScore,
  rankFeaturedBillCandidates,
} from "./featured-bills";

const NOW = new Date("2026-08-28T12:00:00.000Z");

void test("weights public interest above controversy and attention", () => {
  assert.equal(
    featuredBillScore({
      interestScore: 80,
      controversyScore: 70,
      attentionScore: 60,
    }),
    73,
  );
});

void test("keeps recent substantive bills and exceptional older bills", () => {
  const ranked = rankFeaturedBillCandidates(
    [
      {
        id: "recent",
        interestScore: 70,
        controversyScore: 60,
        attentionScore: 60,
        activityAt: new Date("2026-08-20T12:00:00.000Z"),
      },
      {
        id: "old-high-score",
        interestScore: 90,
        controversyScore: 90,
        attentionScore: 90,
        activityAt: new Date("2025-01-01T12:00:00.000Z"),
      },
      {
        id: "old-average-score",
        interestScore: 70,
        controversyScore: 60,
        attentionScore: 60,
        activityAt: new Date("2025-01-01T12:00:00.000Z"),
      },
      {
        id: "recent-low-interest",
        interestScore: 40,
        controversyScore: 100,
        attentionScore: 100,
        activityAt: new Date("2026-08-27T12:00:00.000Z"),
      },
    ],
    NOW,
  );

  assert.deepEqual(
    ranked.map((candidate) => candidate.id),
    ["old-high-score", "recent"],
  );
});

void test("breaks equal scores deterministically", () => {
  const activityAt = new Date("2026-08-20T12:00:00.000Z");
  const ranked = rankFeaturedBillCandidates(
    [
      {
        id: "a",
        interestScore: 80,
        controversyScore: 70,
        attentionScore: 60,
        activityAt,
      },
      {
        id: "b",
        interestScore: 80,
        controversyScore: 60,
        attentionScore: 75,
        activityAt,
      },
    ],
    NOW,
  );

  assert.deepEqual(
    ranked.map((candidate) => candidate.id),
    ["b", "a"],
  );
});
