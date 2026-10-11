import assert from "node:assert/strict";
import test from "node:test";

import type { CanonicalCandidate } from "./candidate-sources/types";
import { biographyFromCanonical } from "./candidate-background";

function record(
  biography: string | undefined,
  cited = true,
): CanonicalCandidate {
  return {
    name: "Ada Example",
    biography,
    citations: cited
      ? [
          {
            field: "biography",
            sourceName: "Ballotpedia",
            sourceUrl: "https://ballotpedia.org/Ada_Example",
            tier: "ballotpedia",
            official: false,
          },
        ]
      : [],
  };
}

void test("a cited biography and photo are returned", () => {
  const sample = record("Served on the city council.");
  sample.photoUrl = "https://example.org/photo.jpg";
  const selected = biographyFromCanonical(sample);
  assert.ok(selected);
  assert.equal(selected.biography, "Served on the city council.");
  assert.equal(selected.sourceName, "Ballotpedia");
  assert.equal(selected.tier, "ballotpedia");
  assert.equal(selected.photoUrl, "https://example.org/photo.jpg");
});

void test("blank prose is ignored", () => {
  assert.equal(biographyFromCanonical(record("   ")), null);
});

void test("prose without a biography citation is ignored", () => {
  assert.equal(biographyFromCanonical(record("Uncited prose.", false)), null);
});
