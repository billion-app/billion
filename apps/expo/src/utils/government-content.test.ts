import assert from "node:assert/strict";
import test from "node:test";

import { contentType, getGovernmentContentLabel } from "@acme/ui/digest-tokens";

import { governmentContentLabel } from "./government-content";

void test("only an executive order receives the order badge", () => {
  assert.equal(getGovernmentContentLabel("Executive Order"), "ORDER");
  assert.equal(getGovernmentContentLabel("Notice"), "NOTICE");
  assert.equal(getGovernmentContentLabel(" memorandum "), "MEMORANDUM");
  assert.equal(getGovernmentContentLabel("Proclamation"), "PROCLAMATION");
  assert.equal(
    getGovernmentContentLabel("Presidential Document"),
    "PRESIDENTIAL DOCUMENT",
  );
  assert.equal(getGovernmentContentLabel("News Article"), "NEWS ARTICLE");
  assert.equal(getGovernmentContentLabel("Fact Sheet"), "FACT SHEET");
  assert.equal(getGovernmentContentLabel("Press Release"), "PRESS RELEASE");
  assert.equal(
    getGovernmentContentLabel("Briefing Statement"),
    "BRIEFING STATEMENT",
  );
  assert.equal(
    getGovernmentContentLabel("Presidential Action"),
    "PRESIDENTIAL ACTION",
  );
});

void test("missing and unknown government types use a neutral badge", () => {
  for (const subtype of [undefined, "", "A new document type", "toString"])
    assert.equal(getGovernmentContentLabel(subtype), "EXECUTIVE");
  assert.equal(contentType.exec.label, "EXECUTIVE");
});

void test("government subtype badges follow the chosen app language", () => {
  assert.equal(governmentContentLabel("Notice", "en"), "Notice");
  assert.equal(governmentContentLabel("Notice", "es"), "Aviso");
  assert.equal(governmentContentLabel("Notice", "zh"), "通知");
  assert.equal(
    governmentContentLabel("Executive Order", "es"),
    "Orden ejecutiva",
  );
  assert.equal(governmentContentLabel(undefined, "en"), "Executive");
  assert.equal(governmentContentLabel(undefined, "es"), "Ejecutivo");
  assert.equal(governmentContentLabel(undefined, "zh"), "行政文件");
});
