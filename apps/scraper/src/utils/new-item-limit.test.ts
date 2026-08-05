import assert from "node:assert/strict";
import test from "node:test";

import { budgetFromEnv, createNewItemLimiter } from "./new-item-limit.js";

test("a configured budget of zero is honoured, not treated as unset", () => {
  // `Number(env) || DEFAULT` used to turn an explicit 0 into 10, so a run
  // configured to fetch without generating anything quietly generated ten
  // items' worth of briefs, lenses and header art.
  assert.equal(budgetFromEnv("0"), 0);
  assert.equal(createNewItemLimiter(budgetFromEnv("0")).tryConsume(), false);
});

test("budget falls back to the default when unset or malformed", () => {
  assert.equal(budgetFromEnv(undefined), 10);
  assert.equal(budgetFromEnv(""), 10);
  assert.equal(budgetFromEnv("   "), 10);
  assert.equal(budgetFromEnv("lots"), 10);
  assert.equal(budgetFromEnv("-5"), 10);
  assert.equal(budgetFromEnv("2.5"), 10);
});

test("a valid budget is read from the environment", () => {
  assert.equal(budgetFromEnv("25"), 25);
});

/**
 * Mirrors the per-item claim in `upsertContent`. An item draws at most one
 * slot no matter how many assets it generates, and only when it generates
 * something at all.
 */
function makeClaim(limiter: { tryConsume(): boolean }) {
  let taken = false;
  return () => {
    if (taken) return true;
    if (limiter.tryConsume()) {
      taken = true;
      return true;
    }
    return false;
  };
}

test("one item draws one slot however many assets it generates", () => {
  const limiter = createNewItemLimiter(2);

  const first = makeClaim(limiter);
  // article, then lens, then brief, then video — all for the same item.
  assert.equal(first(), true);
  assert.equal(first(), true);
  assert.equal(first(), true);
  assert.equal(first(), true);

  const second = makeClaim(limiter);
  assert.equal(second(), true);

  // Budget of 2 is now spent, so a third item generates nothing.
  const third = makeClaim(limiter);
  assert.equal(third(), false);
});

test("an item that generates nothing does not spend budget", () => {
  const limiter = createNewItemLimiter(1);

  // A fully cached item never calls its claim at all.
  makeClaim(limiter);

  // ...so the single slot is still available to an item that does work.
  const worker = makeClaim(limiter);
  assert.equal(worker(), true);
});

test("a denied item stays denied for its remaining assets", () => {
  const limiter = createNewItemLimiter(1);

  const first = makeClaim(limiter);
  assert.equal(first(), true);

  // Second item is refused up front and must not sneak its lens or brief
  // through on a later call — the regression that let a backfill regenerate
  // every existing bill's derived assets uncapped.
  const second = makeClaim(limiter);
  assert.equal(second(), false);
  assert.equal(second(), false);
  assert.equal(second(), false);
});
