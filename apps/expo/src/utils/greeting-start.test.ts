import assert from "node:assert/strict";
import test from "node:test";

import type { CeremonyEvent, CeremonyState } from "./greeting-start";
import {
  ceremonyReducer,
  initialCeremonyState,
  sheetVisible,
} from "./greeting-start";

function fold(
  events: CeremonyEvent[],
  start: CeremonyState = initialCeremonyState(true),
): CeremonyState {
  return events.reduce(ceremonyReducer, start);
}

void test("boot stays boot until storage decides", () => {
  const state = fold([
    { type: "splashHidden" },
    { type: "stageReady", ready: true },
  ]);
  assert.equal(state.phase, "boot");
  assert.equal(sheetVisible(state.phase), false);
});

void test("a returning visit skips straight to settled", () => {
  const state = fold([{ type: "decided", play: false }]);
  assert.equal(state.phase, "settled");
  assert.equal(sheetVisible(state.phase), true);
});

void test("the ceremony waits while splash still covers the tree", () => {
  const state = fold([
    { type: "decided", play: true },
    { type: "stageReady", ready: true },
  ]);
  assert.equal(state.phase, "wait");
});

void test("the ceremony waits while the local rail is still in flight", () => {
  const state = fold([
    { type: "decided", play: true },
    { type: "splashHidden" },
  ]);
  assert.equal(state.phase, "wait");
});

void test("play starts as soon as splash and rail are up", () => {
  const state = fold([
    { type: "decided", play: true },
    { type: "splashHidden" },
    { type: "stageReady", ready: true },
  ]);
  assert.equal(state.phase, "play");
  assert.equal(sheetVisible(state.phase), true);
});

void test("a backgrounded launch does not burn the one-shot unseen", () => {
  const waiting = fold(
    [{ type: "decided", play: true }, { type: "waitExpired" }],
    initialCeremonyState(false),
  );
  assert.equal(waiting.phase, "wait");
  const resumed = ceremonyReducer(waiting, {
    type: "appActive",
    active: true,
  });
  assert.equal(resumed.phase, "play");
});

void test("a hung fetch cannot stall the greeting forever", () => {
  const state = fold([
    { type: "decided", play: true },
    { type: "waitExpired" },
  ]);
  assert.equal(state.phase, "play");
});

void test("reduced motion skips the wait", () => {
  const state = fold([
    { type: "reduceMotion", value: true },
    { type: "decided", play: true },
  ]);
  assert.equal(state.phase, "settled");
});

void test("dev freeze frames skip the wait and play immediately", () => {
  const state = fold([
    { type: "freeze", on: true },
    { type: "decided", play: true },
  ]);
  assert.equal(state.phase, "play");
});

void test("play is sticky until finished", () => {
  const playing = fold([
    { type: "decided", play: true },
    { type: "splashHidden" },
    { type: "stageReady", ready: true },
  ]);
  const flickered = ceremonyReducer(playing, {
    type: "stageReady",
    ready: false,
  });
  assert.equal(flickered.phase, "play");
  const done = ceremonyReducer(playing, { type: "finished" });
  assert.equal(done.phase, "settled");
});
