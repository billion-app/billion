import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import ts from "typescript";

import { labels, readerLabel } from "./reader-labels";

void test("embedded reader controls have complete translations, including drawers and map tools", () => {
  const source = readFileSync(
    new URL("./reader-engine.js", import.meta.url),
    "utf8",
  );
  const file = ts.createSourceFile(
    "reader-engine.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "tr") {
      const key = node.arguments[0];
      const checkKey = (key: ts.Node) => {
        if (ts.isStringLiteral(key))
          assert.ok(
            labels[key.text],
            `Missing reader translation: ${key.text}`,
          );
        else if (ts.isConditionalExpression(key)) {
          checkKey(key.whenTrue);
          checkKey(key.whenFalse);
        }
      };
      if (key) checkKey(key);
    }
    if (ts.isStringLiteral(node))
      assert.ok(
        !node.text.includes("${tr("),
        "Interpolation must be a template, not a quoted string",
      );
    ts.forEachChild(node, visit);
  };
  visit(file);
  const vars = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, translations] of Object.entries(labels)) {
    for (const language of ["es", "zh"] as const) {
      assert.ok(translations[language].trim(), `${key}: ${language}`);
      assert.deepEqual(
        vars(translations[language]),
        vars(key),
        `${key}: ${language}`,
      );
    }
  }
  assert.equal(
    readerLabel("zh", "Your flag: {flag}", {
      flag: readerLabel("zh", "False choice"),
    }),
    "你的标记：虚假两难",
  );
});

void test("embedded reader counts use singular forms in English and Spanish", () => {
  assert.equal(
    readerLabel("en", "{count} arguments", { count: 1 }),
    "1 argument",
  );
  assert.equal(
    readerLabel("es", "{count} arguments", { count: 1 }),
    "1 argumento",
  );
  assert.equal(
    readerLabel("zh", "{count} arguments", { count: 2 }),
    "2 个论点",
  );
});
