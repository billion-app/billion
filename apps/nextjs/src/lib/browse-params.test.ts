import assert from "node:assert/strict";
import test from "node:test";

import {
  browseHref,
  parseBrowseParams,
  scopeFromCookie,
} from "./browse-params";

void test("reads scope, type and a trimmed query from the URL", () => {
  assert.deepEqual(
    parseBrowseParams({ scope: "ca", type: "bill", q: " wildfire " }),
    { scope: "ca", type: "bill", q: "wildfire" },
  );
});

void test("an unknown or retired scope reads as unset, not federal", () => {
  assert.equal(parseBrowseParams({ scope: "zz" }).scope, null);
  assert.equal(parseBrowseParams({ scope: "mo" }).scope, null);
  assert.equal(parseBrowseParams({}).scope, null);
});

void test("an unknown type falls back to all", () => {
  assert.equal(parseBrowseParams({ type: "memes" }).type, "all");
});

void test("repeated params use the first value", () => {
  assert.equal(parseBrowseParams({ scope: ["tx", "ca"] }).scope, "tx");
});

void test("accepts URLSearchParams", () => {
  assert.deepEqual(
    parseBrowseParams(new URLSearchParams("scope=nc&type=court_case")),
    { scope: "nc", type: "court_case", q: "" },
  );
});

void test("browseHref always names the scope, so a federal link stays federal", () => {
  assert.equal(
    browseHref({ scope: "federal", type: "all", q: "" }),
    "/browse?scope=federal",
  );
  assert.equal(
    browseHref({ scope: "ca", type: "bill", q: "wildfire smoke" }),
    "/browse?scope=ca&type=bill&q=wildfire+smoke",
  );
  assert.equal(
    browseHref({ scope: "federal", type: "all", q: "  " }),
    "/browse?scope=federal",
  );
});

void test("the scope cookie accepts supported scopes only", () => {
  assert.equal(scopeFromCookie("tx"), "tx");
  assert.equal(scopeFromCookie("federal"), "federal");
  assert.equal(scopeFromCookie("mo"), null);
  assert.equal(scopeFromCookie(undefined), null);
});
