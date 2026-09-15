import assert from "node:assert/strict";
import { test } from "node:test";

import { getDevBallot } from "./ballot-dev-mocks";

void test("mock addresses are inert outside development and never intercept real addresses", () => {
  const original = process.env.NODE_ENV;
  try {
    for (const environment of ["production", "test", "development"]) {
      process.env.NODE_ENV = environment;
      assert.equal(getDevBallot("100 Main Street"), undefined);
      if (environment !== "development") {
        assert.equal(getDevBallot("mock:full"), undefined);
        assert.equal(getDevBallot("mock:error"), undefined);
      }
    }
    assert.equal(getDevBallot("Mock:full")?.kind, "development-fixture");
    const full = getDevBallot("mock:full");
    assert.equal(full?.contests?.length, 2);
    assert.equal(full.dropOffLocations?.length, 1);
    const partial = getDevBallot("mock:partial");
    assert.equal(partial?.pollingLocations, undefined);
    assert.equal(partial?.contests?.[0]?.candidates?.[0]?.statement, undefined);
    assert.equal(getDevBallot("mock:empty")?.contests?.length, 0);
    assert.throws(() => getDevBallot("mock:error"), /Synthetic/);
    assert.equal(getDevBallot("mock:full")?.dropOffLocations?.length, 1);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
