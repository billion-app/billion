import assert from "node:assert/strict";
import test from "node:test";

import { ceremonyShouldHold } from "./greeting-start";

const ready = {
  play: true,
  freeze: false,
  reduceMotion: false,
  stageReady: true,
  splashHidden: true,
  appActive: true,
  waitExpired: false,
};

void test("the ceremony waits while splash still covers the tree", () => {
  assert.equal(ceremonyShouldHold({ ...ready, splashHidden: false }), true);
});

void test("the ceremony waits while home queries are still in flight", () => {
  assert.equal(ceremonyShouldHold({ ...ready, stageReady: false }), true);
});

void test("a backgrounded launch does not burn the one-shot unseen", () => {
  assert.equal(ceremonyShouldHold({ ...ready, appActive: false }), true);
  assert.equal(
    ceremonyShouldHold({ ...ready, appActive: false, waitExpired: true }),
    true,
  );
});

void test("once the surface is visible the hold lifts", () => {
  assert.equal(ceremonyShouldHold(ready), false);
});

void test("a hung fetch cannot stall the greeting forever", () => {
  assert.equal(
    ceremonyShouldHold({
      ...ready,
      stageReady: false,
      splashHidden: false,
      waitExpired: true,
    }),
    false,
  );
});

void test("returning visits and reduced motion skip the wait", () => {
  assert.equal(ceremonyShouldHold({ ...ready, play: false }), false);
  assert.equal(ceremonyShouldHold({ ...ready, reduceMotion: true }), false);
});

void test("dev freeze frames are never held", () => {
  assert.equal(
    ceremonyShouldHold({
      ...ready,
      freeze: true,
      splashHidden: false,
      stageReady: false,
    }),
    false,
  );
});
