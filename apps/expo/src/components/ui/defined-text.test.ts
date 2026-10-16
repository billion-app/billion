import assert from "node:assert/strict";
import test from "node:test";

import { splitDefinedText } from "./defined-text";

const terms = [
  { term: "Medicare", plain: "An existing program." },
  { term: "Medicare for All", plain: "A proposed national program." },
  { term: "bill", plain: "A proposed law." },
  { term: "C++", plain: "Literal punctuation." },
];
void test("definitions match whole terms, longest first, regardless of case without changing text", () => {
  const text =
    "MEDICARE FOR ALL, Medicare; billion bills bill. C++ and ébill remain literal.";
  const parts = splitDefinedText(text, terms);
  assert.equal(parts.map((p) => p.text).join(""), text);
  assert.deepEqual(
    parts.flatMap((p) => p.definition?.term ?? []),
    ["Medicare for All", "Medicare", "bill", "C++"],
  );
  assert.equal(terms[0]?.term, "Medicare");
});
void test("overlapping exact emphasis survives a definition spanning several words", () => {
  const parts = splitDefinedText("Medicare for All and Medicare.", terms, [
    "for All and Medicare",
  ]);
  assert.equal(
    parts
      .filter((p) => p.emphasized)
      .map((p) => p.text)
      .join(""),
    "for All and Medicare",
  );
  assert.equal(
    parts
      .filter((p) => p.definition?.term === "Medicare for All")
      .map((p) => p.text)
      .join(""),
    "Medicare for All",
  );
});
void test("blank vocabulary and empty emphasis cannot loop or produce invented definitions", () => {
  const parts = splitDefinedText(
    "A bill and a BILL.",
    [
      { term: "", plain: "No" },
      { term: "bill", plain: "" },
    ],
    ["", "bill"],
  );
  assert.equal(
    parts.some((p) => p.definition),
    false,
  );
  assert.equal(
    parts
      .filter((p) => p.emphasized)
      .map((p) => p.text)
      .join(""),
    "bill",
  );
  assert.deepEqual(splitDefinedText(""), []);
});
