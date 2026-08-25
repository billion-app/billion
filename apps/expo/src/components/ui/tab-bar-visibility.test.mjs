import assert from "node:assert/strict";
import test from "node:test";

import { isTabRouteHidden } from "./tab-bar-visibility.ts";

test("hides Feed after Expo Router transforms href null", () => {
  assert.equal(
    isTabRouteHidden({
      routeName: "feed",
      isDev: false,
      itemDisplay: "none",
    }),
    true,
  );
});

test("retains the production Settings fallback", () => {
  assert.equal(
    isTabRouteHidden({ routeName: "settings", isDev: false }),
    true,
  );
});

test("shows ordinary tabs", () => {
  assert.equal(
    isTabRouteHidden({ routeName: "index", isDev: false }),
    false,
  );
});
