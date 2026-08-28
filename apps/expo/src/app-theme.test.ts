import assert from "node:assert/strict";
import { test } from "node:test";

import { darkTheme } from "@acme/ui/theme-tokens";

import { resolveAppTheme } from "./app-theme";

test("the dark-only app ignores a light system appearance", () => {
  const resolved = resolveAppTheme("light");

  assert.equal(resolved.colorScheme, "dark");
  assert.equal(resolved.isDark, true);
  assert.equal(resolved.theme.background, darkTheme.background);
  assert.equal(resolved.theme.foreground, darkTheme.foreground);
  assert.equal(resolved.theme.card, darkTheme.card);
});
