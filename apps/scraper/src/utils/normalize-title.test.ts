import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTitle } from "./normalize-title.js";

void test("a curly apostrophe matches a straight one", () => {
  // whitehouse.gov renders typographic quotes, the Federal Register does not.
  assert.equal(
    normalizeTitle("Establishing the President’s Military Spouse Commission"),
    normalizeTitle("Establishing the President's Military Spouse Commission"),
  );
});

void test("capitalisation and spacing differences collapse", () => {
  assert.equal(
    normalizeTitle("To Facilitate Positive Adjustment to Competition"),
    normalizeTitle("to facilitate  positive adjustment To competition"),
  );
});

void test("titles that differ in substance stay different", () => {
  assert.notEqual(
    normalizeTitle("Ending Birth Tourism"),
    normalizeTitle("Ending Birthright Tourism"),
  );
});

void test("punctuation is dropped rather than mapped to a space", () => {
  // Guards the regex from being rewritten to a space-join, which would make
  // "Sub-Committee" and "Sub Committee" normalise differently again.
  assert.equal(normalizeTitle("Sub-Committee, 2026"), "subcommittee2026");
});
