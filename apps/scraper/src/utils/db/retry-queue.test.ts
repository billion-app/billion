import assert from "node:assert/strict";
import test from "node:test";

import { backoffFor } from "./retry-queue.js";

test("backoff grows then caps at a day", () => {
  const minute = 60 * 1000;
  // First failure waits 15 minutes, not a day — most deferrals are transient
  // (a rate limit, a provider blip) and should come back within the same run
  // window if there is one.
  assert.equal(backoffFor(1), 15 * minute);
  assert.equal(backoffFor(2), 30 * minute);
  assert.equal(backoffFor(3), 60 * minute);

  // Capped, so a permanently broken item costs one attempt a day rather than
  // one per run forever.
  const day = 24 * 60 * minute;
  assert.equal(backoffFor(20), day);
  assert.equal(backoffFor(100), day);

  // 2 ** large would overflow to Infinity and produce an invalid Date rather
  // than a clamped one, so the guard has to come before the multiply.
  assert.equal(backoffFor(1e6), day);
  assert.ok(Number.isFinite(backoffFor(Number.MAX_SAFE_INTEGER)));
});

test("backoff is monotonic and never zero", () => {
  // A zero or shrinking delay would let a failing item be retried immediately,
  // turning one bad bill into a hot loop against congress.gov and the LLM.
  let previous = 0;
  for (let attempts = 1; attempts <= 30; attempts++) {
    const delay = backoffFor(attempts);
    assert.ok(delay > 0, `attempt ${attempts} produced ${delay}`);
    assert.ok(delay >= previous, `attempt ${attempts} went backwards`);
    previous = delay;
  }
});

test("backoff tolerates a nonsense attempt count", () => {
  // attempts comes from a DB column; a 0 or negative value should still yield a
  // usable delay rather than a negative date.
  assert.equal(backoffFor(0), 15 * 60 * 1000);
  assert.equal(backoffFor(-5), 15 * 60 * 1000);
});
