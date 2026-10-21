import assert from "node:assert/strict";
import test from "node:test";

import type { AlertItem } from "./alert-history";
import { alertTranslationWait } from "./alert-translation-wait";

const alert: AlertItem = {
  id: "alert-a",
  at: "2026-10-20T12:00:00Z",
  kind: "follow",
  title: "A bill advanced",
  body: "The committee passed it.",
  translationState: "pending",
};

void test("alerts arriving after two idle minutes get a full translation wait", () => {
  assert.equal(alertTranslationWait(null, "es", undefined, 0), null);
  assert.equal(alertTranslationWait(null, "es", [], 120_000), null);
  assert.equal(
    alertTranslationWait(null, "es", [alert], 180_000)?.deadline,
    300_000,
  );
});

void test("partial completion keeps its deadline while new alerts and revisions restart it", () => {
  const second = { ...alert, id: "alert-b" };
  const initial = alertTranslationWait(null, "es", [alert, second], 0);
  assert.equal(
    alertTranslationWait(
      initial,
      "es",
      [{ ...alert, translationState: "translated" }, second],
      60_000,
    ),
    initial,
  );
  for (const items of [
    [alert, second, { ...alert, id: "alert-c" }],
    [{ ...alert, body: "The source was corrected." }],
    [{ ...alert, title: "The title was corrected." }],
  ])
    assert.equal(
      alertTranslationWait(initial, "es", items, 150_000)?.deadline,
      270_000,
    );
  assert.equal(
    alertTranslationWait(initial, "zh", [alert], 150_000)?.deadline,
    270_000,
  );
  assert.equal(
    alertTranslationWait(null, "es", [alert], 150_000)?.deadline,
    270_000,
  );
});

void test("completed histories and English have no pending wait", () => {
  const initial = alertTranslationWait(null, "es", [alert], 0);
  assert.equal(alertTranslationWait(initial, "es", [], 60_000), null);
  assert.equal(
    alertTranslationWait(
      initial,
      "es",
      [{ ...alert, translationState: "translated" }],
      60_000,
    ),
    null,
  );
  assert.equal(alertTranslationWait(initial, "en", [alert], 60_000), null);
});
