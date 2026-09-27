import assert from "node:assert/strict";
import test from "node:test";

import { digestCssVariables } from "./digest-css";

void test("emits every Digest group as a --digest-<group>-<key> property", () => {
  const css = digestCssVariables();
  assert.ok(css.startsWith(":root{"));
  assert.ok(css.endsWith("}"));
  assert.ok(css.includes("--digest-planes-navy:#0E1530;"));
  assert.ok(css.includes("--digest-digest-ink-on-night:#F7F4EE;"));
  assert.ok(css.includes("--digest-hair-card-border:rgba(247,244,238,0.08);"));
  assert.ok(css.includes("--digest-hair-1:rgba(255,255,255,0.06);"));
  assert.ok(css.includes("--digest-outcome-gains:#55D6BE;"));
  assert.ok(css.includes("--digest-type-bill:#4A7CFF;"));
});

void test("numeric tokens become pixel lengths", () => {
  const css = digestCssVariables();
  assert.ok(css.includes("--digest-radius-card:24px;"));
  assert.ok(css.includes("--digest-space-screen-pad-x:16px;"));
});
