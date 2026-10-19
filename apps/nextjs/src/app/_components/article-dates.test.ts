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

void test("article date labels follow the selected reader language", () => {
  for (const language of ["es", "zh"] as const) {
    const html = renderToStaticMarkup(
      React.createElement(ArticleDates, {
        language,
        introducedDate: new Date("2026-10-15T00:00:00Z"),
        createdAt: new Date("2026-10-17T12:00:00Z"),
        updatedAt: new Date("2026-10-18T12:00:00Z"),
      }),
    );
    assert.match(html, language === "es" ? /Presentado/ : /提出日期/);
    assert.match(
      html,
      language === "es" ? /Actualizado en Billion/ : /Billion 更新于/,
    );
    assert.doesNotMatch(html, /Introduced|Updated on Billion/);
  }
});

void test("government and court headers show source dates instead of import dates", () => {
  for (const kind of ["published", "courtRecordDated"] as const) {
    const dates = {
      sourceDate: {
        kind,
        date: new Date("2026-10-15T00:00:00Z"),
        timeZone: "UTC" as const,
      },
      createdAt: new Date("2026-10-17T12:00:00Z"),
      updatedAt: new Date("2026-10-18T12:00:00Z"),
    };
    const html = renderToStaticMarkup(React.createElement(ArticleDates, dates));
    assert.match(
      html,
      kind === "published"
        ? /Published <time[^>]*>Oct 15, 2026/
        : /Court record dated <time[^>]*>Oct 15, 2026/,
    );
    assert.doesNotMatch(html, /Added to Billion|Oct 17|Filed|Decided/);
  }
});

void test("source-specific labels and publication timezone survive every reader language", () => {
  const cases = [
    [
      {
        kind: "whiteHousePublished",
        date: new Date("2026-10-16T00:30:00Z"),
        timeZone: "America/New_York",
      },
      {
        en: "Posted by White House",
        es: "Publicado por la Casa Blanca",
        zh: "白宫发布于",
      },
    ],
    [
      {
        kind: "federalRegisterPublished",
        date: new Date("2026-10-15T00:00:00Z"),
        timeZone: "UTC",
      },
      {
        en: "Published in Federal Register",
        es: "Publicado en el Federal Register",
        zh: "联邦公报发布于",
      },
    ],
    [
      {
        kind: "opinionReleased",
        date: new Date("2026-10-15T00:00:00Z"),
        timeZone: "UTC",
      },
      { en: "Opinion released", es: "Opinión publicada", zh: "意见发布于" },
    ],
    [
      {
        kind: "latestDocketEntry",
        date: new Date("2026-10-15T00:00:00Z"),
        timeZone: "UTC",
      },
      {
        en: "Latest docket entry",
        es: "Última entrada del expediente",
        zh: "最新案卷记录",
      },
    ],
  ] as const;
  for (const language of ["en", "es", "zh"] as const) {
    for (const [sourceDate, labels] of cases) {
      const html = renderToStaticMarkup(
        React.createElement(ArticleDates, {
          language,
          sourceDate,
          createdAt: new Date("2026-10-17T12:00:00Z"),
          updatedAt: new Date("2026-10-18T12:00:00Z"),
        }),
      );
      assert.ok(html.includes(labels[language]));
      const visibleDate = html.match(/<time[^>]*>([^<]+)<\/time>/)?.[1];
      assert.equal(
        visibleDate,
        sourceDate.date.toLocaleDateString(
          language === "zh" ? "zh-CN" : `${language}-US`,
          {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: sourceDate.timeZone,
          },
        ),
      );
      assert.doesNotMatch(html, /Added to Billion|Signed|Decided/);
    }
  }
});

void test("an explicitly absent court date uses the honest import-date fallback", () => {
  const html = renderToStaticMarkup(
    React.createElement(ArticleDates, {
      sourceDate: null,
      createdAt: new Date("2026-10-17T12:00:00Z"),
      updatedAt: new Date("2026-10-18T12:00:00Z"),
    }),
  );
  assert.match(html, /Added to Billion/);
  assert.doesNotMatch(
    html,
    /Opinion released|Latest docket entry|Court record dated/,
  );
});
