import assert from "node:assert/strict";
import test from "node:test";

import {
  cardTranslationPolling,
  cardTranslationState,
} from "./card-translation";

void test("featured, search, saved and infinite feeds keep polling queued cards", () => {
  const items = [
    { translationState: "translated" as const },
    { translationState: "pending" as const },
  ];
  for (const data of [items, { items }, { pages: [{ items }] }])
    assert.equal(cardTranslationPolling({ state: { data } }), 3000);
  assert.equal(
    cardTranslationPolling({
      state: { data: [{ translationState: "translated" }] },
    }),
    false,
  );
  assert.equal(
    cardTranslationPolling({
      state: { data: [{ translationState: "unavailable" }] },
    }),
    false,
  );
});

void test("the notice never implies an English fallback is translated", () => {
  assert.equal(cardTranslationState([{}], "zh"), "pending");
  assert.equal(
    cardTranslationState(
      [{ translationState: "translated" }, { translationState: "pending" }],
      "es",
    ),
    "pending",
  );
  assert.equal(
    cardTranslationState([{ translationState: "unavailable" }], "zh"),
    "unavailable",
  );
  assert.equal(
    cardTranslationState([{ translationState: "translated" }], "zh"),
    "translated",
  );
  assert.equal(
    cardTranslationState([{ translationState: "pending" }], "en"),
    "original",
  );
  assert.equal(cardTranslationState([], "zh"), "original");
});

void test("network failure offers retry without hiding an already complete cached translation", () => {
  assert.equal(
    cardTranslationState([{ translationState: "pending" }], "zh", true),
    "unavailable",
  );
  assert.equal(
    cardTranslationState([{ translationState: "translated" }], "zh", true),
    "translated",
  );
});
