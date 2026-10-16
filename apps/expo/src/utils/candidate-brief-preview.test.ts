import assert from "node:assert/strict";
import test from "node:test";

import { candidateBriefSchema } from "@acme/validators";

import { candidateBriefPreview } from "./candidate-brief-preview";

void test("fictional populated and mixed fixtures meet the shared schema", () => {
  Object.defineProperty(globalThis, "__DEV__", {
    value: true,
    configurable: true,
  });
  for (const mode of ["reviewed", "mixed"]) {
    const brief = candidateBriefPreview(mode);
    assert.ok(brief);
    assert.equal(candidateBriefSchema.safeParse(brief).success, true);
    assert.equal(brief.identity.jurisdiction, "fictional:ca");
  }
  assert.equal(candidateBriefPreview("arbitrary"), undefined);
});
void test("production cannot display candidate brief previews", () => {
  Object.defineProperty(globalThis, "__DEV__", {
    value: false,
    configurable: true,
  });
  assert.equal(candidateBriefPreview("reviewed"), undefined);
  assert.equal(candidateBriefPreview("mixed"), undefined);
});
