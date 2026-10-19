/* eslint-disable turbo/no-undeclared-env-vars -- Verify calendar dates in the reader's timezone. */
/* eslint-disable no-restricted-properties -- TZ controls this test's runtime, not application configuration. */
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ArticleDates } from "./article-dates";

Object.assign(globalThis, { React });

void test("bill header shows its introduction day rather than ingestion day", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    const dates = {
      introducedDate: new Date("2026-10-15T00:00:00Z"),
      createdAt: new Date("2026-10-17T12:00:00Z"),
      updatedAt: new Date("2026-10-18T12:00:00Z"),
    };
    const html = renderToStaticMarkup(React.createElement(ArticleDates, dates));
    assert.match(html, /Introduced <time[^>]*>Oct 15, 2026<\/time>/);
    assert.match(html, /Updated on Billion <time[^>]*>Oct 18, 2026<\/time>/);
    assert.doesNotMatch(html, /Oct 17|Created|Last updated/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

void test("missing introduction date labels ingestion as Added to Billion", () => {
  const html = renderToStaticMarkup(
    React.createElement(ArticleDates, {
      createdAt: new Date("2026-10-17T12:00:00Z"),
      updatedAt: new Date("2026-10-18T12:00:00Z"),
    }),
  );
  assert.match(html, /Added to Billion <time[^>]*>Oct 17, 2026<\/time>/);
  assert.doesNotMatch(html, /Introduced|Created/);
});
