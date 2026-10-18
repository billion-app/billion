import assert from "node:assert/strict";
import test from "node:test";

import { CATALOG, translateApp } from "./app-strings";
import {
  formatCurrency,
  formatDate,
  formatList,
  formatNumber,
  formatPercent,
} from "./format";

void test("every app message supplies complete translations and identical interpolation variables", () => {
  const placeholders = (text: string) =>
    [
      ...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
    ].sort();
  for (const [key, entry] of Object.entries(CATALOG)) {
    assert.deepEqual(Object.keys(entry).sort(), ["en", "es", "zh"], key);
    const source = typeof entry.en === "string" ? entry.en : entry.en.other;
    for (const lang of ["en", "es", "zh"] as const) {
      const phrase = entry[lang];
      const forms =
        typeof phrase === "string" ? [phrase] : [phrase.one, phrase.other];
      for (const form of forms) {
        assert.ok(form.trim(), `${key}: ${lang} is empty`);
        assert.deepEqual(
          placeholders(form),
          placeholders(source),
          `${key}: ${lang}`,
        );
      }
    }
  }
});

void test("all app messages resolve without leaking keys or interpolation tokens", () => {
  for (const [key, entry] of Object.entries(CATALOG)) {
    const english = typeof entry.en === "string" ? entry.en : entry.en.other;
    const vars = Object.fromEntries(
      [...english.matchAll(/\{(\w+)\}/g)].map((match) => [
        match[1] ?? "",
        "value",
      ]),
    );
    for (const language of ["en", "es", "zh"] as const) {
      for (const count of [0, 1, 2, 1200]) {
        const text = translateApp(language, key as keyof typeof CATALOG, {
          ...vars,
          count,
        });
        assert.ok(text.length > 0, `${key}: ${language}`);
        assert.doesNotMatch(text, /\{\w+\}/, `${key}: ${language}`);
      }
    }
  }
});

void test("locale formatting preserves dates and monetary magnitudes", () => {
  assert.equal(
    formatDate("zh", "2026-11-03", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
    "2026年11月3日",
  );
  assert.equal(formatDate("en", "invalid"), "");
  for (const language of ["en", "es", "zh"] as const) {
    const locale = language === "zh" ? "zh-CN" : `${language}-US`;
    assert.equal(
      formatNumber(language, 11250000000),
      new Intl.NumberFormat(locale).format(11250000000),
    );
    assert.equal(
      formatCurrency(language, 11250000000),
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(11250000000),
    );
    assert.equal(
      formatPercent(language, 0.52),
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 0,
      }).format(0.52),
    );
  }
  assert.equal(formatList("zh", ["A", "B", "C"]), "A、B、C");
  assert.equal(formatList("es", ["A", "B", "C"]), "A, B y C");
});

void test("count messages use whole localized forms without English suffixes", () => {
  assert.equal(
    translateApp("es", "materials.verified", { count: 1 }),
    "1 material verificado",
  );
  assert.equal(
    translateApp("es", "materials.verified", { count: 2 }),
    "2 materiales verificados",
  );
  assert.equal(
    translateApp("zh", "materials.verified", { count: 2 }),
    "2 份已核实材料",
  );
  assert.equal(
    translateApp("zh", "documents.publicComments", { count: 2 }),
    "官方记录中的 2 封公众意见信",
  );
});
