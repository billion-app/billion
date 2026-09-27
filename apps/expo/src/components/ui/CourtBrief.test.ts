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
        // The native icon implementation pulls in Expo's JSX-in-.js bundle,
        // which this focused Node renderer intentionally does not transpile.
        // Icons are decorative here; preserve the real brief component and
        // replace only that platform boundary with a no-op component.
        if (
          specifier === "./Icon" &&
          context.parentURL?.endsWith("/CourtBrief.tsx")
        ) {
          return {
            shortCircuit: true,
            url: new URL("./Icon.test-stub.ts", context.parentURL).href,
          };
        }
        return nextResolve(
          specifier === "react-native" ? "react-native-web" : specifier,
          context,
        );
      },
    });
    try {
      Object.assign(globalThis, { React });
      const { CourtBrief, CourtOpinions } = await import("./CourtBrief");
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
      assert.match(html, /The short version/);
      assert.match(html, /Emergency order/);
      assert.match(html, /Temporary decision/);
      assert.match(html, /What the court did/);
      assert.match(html, /Tap any blue legal term/);
      assert.match(html, /Define stay/);
      assert.doesNotMatch(html, /A temporary pause/);
      assert.match(html, /How the court got there/);
      assert.match(html, /Who it lands on/);
      assert.match(html, /Separate opinions/);
      assert.match(html, /What the ruling/);
      assert.match(html, /does not finally resolve/);
      assert.match(html, /CONCURRENCE/);
      assert.match(html, /DISSENT/);
      assert.match(html, /role="link"/);
      assert.match(html, /Open full official document document-1/);
      assert.doesNotMatch(html, /Becomes law|Committee review/);
      const opinionsHtml = renderToStaticMarkup(
        React.createElement(CourtOpinions, { data: valid.courtBrief }),
      );
      assert.match(opinionsHtml, /Read the opinions/);
      assert.match(opinionsHtml, /CONCURRENCE/);
      assert.match(opinionsHtml, /DISSENT/);
      assert.match(opinionsHtml, /Official documents/);
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
