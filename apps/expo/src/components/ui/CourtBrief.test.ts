import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { join } from "node:path";
import test from "node:test";
import React from "react";

import type { RouterOutputs } from "@acme/api";

type CourtDetail = Extract<
  RouterOutputs["content"]["getById"],
  { type: "court_case" }
>;
// Render the actual native component through React Native Web, as Expo web does.
void test(
  "the real tRPC court response renders an interim brief; missing/stale/invalid records retain text",
  { skip: !process.env.COURT_BRIEF_TEST_ARTIFACT_DIR },
  async () => {
    const directory = process.env.COURT_BRIEF_TEST_ARTIFACT_DIR;
    assert.ok(directory);
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        return nextResolve(
          specifier === "react-native" ? "react-native-web" : specifier,
          context,
        );
      },
    });
    try {
      Object.assign(globalThis, { React });
      const { CourtBrief } = await import("./CourtBrief");
      const { renderToStaticMarkup } = createRequire(import.meta.url)(
        "react-dom/server",
      ) as { renderToStaticMarkup: (element: React.ReactElement) => string };
      const valid = JSON.parse(
        readFileSync(join(directory, "valid.json"), "utf8"),
      ) as CourtDetail;
      assert.ok(valid.courtBrief);
      const html = renderToStaticMarkup(
        React.createElement(CourtBrief, { data: valid.courtBrief }),
      );
      assert.match(html, /Emergency order/);
      assert.match(html, /Interim relief/);
      assert.match(html, /What the court did/);
      assert.match(html, /What remains unresolved/);
      assert.match(html, /does not finally resolve/);
      assert.match(html, /concurrence/);
      assert.match(html, /dissent/);
      assert.match(html, /role="link"/);
      assert.match(html, /Open full official document document-1/);
      assert.doesNotMatch(html, /Becomes law|Committee review/);
      writeFileSync(join(directory, "court-brief.html"), html);
      for (const name of ["missing", "stale", "invalid"]) {
        const detail = JSON.parse(
          readFileSync(join(directory, `${name}.json`), "utf8"),
        ) as CourtDetail;
        assert.equal(detail.courtBrief, null);
        assert.ok(detail.articleContent.length > 0);
      }
    } finally {
      hooks.deregister();
    }
  },
);
