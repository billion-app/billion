import assert from "node:assert/strict";
import test from "node:test";

import type { AppStringKey } from "./app-strings";
import { translateApp } from "./app-strings";

const LANGUAGES = ["en", "es", "zh"] as const;
const POLICY_SECTIONS = Array.from(
  { length: 12 },
  (_, i) => `terms.p${i + 1}Body` as AppStringKey,
);
const SENTENCE_END = /[.。”"）)]$/;

void test("privacy policy paragraphs split at sentence ends, aligned across languages", () => {
  for (const key of POLICY_SECTIONS) {
    const counts = LANGUAGES.map((language) => {
      const chunks = translateApp(language, key, { email: "x@example.com" })
        .split("\n\n")
        .map((chunk) => chunk.trim());
      for (const chunk of chunks) {
        assert.ok(chunk.length > 0, `${key}: ${language} has an empty chunk`);
        assert.match(chunk, SENTENCE_END, `${key}: ${language} mid-sentence`);
      }
      return chunks.length;
    });
    assert.equal(new Set(counts).size, 1, `${key}: ${counts.join("/")}`);
  }
  // The long sections are the ones readers were asked to scroll through.
  for (const key of ["terms.p1Body", "terms.p4Body"] as const) {
    assert.ok(translateApp("en", key).split("\n\n").length >= 3, key);
  }
});

void test("news-location fallbacks never send readers to their voter registration", () => {
  const registration = /regist|登记/i;
  for (const reason of [
    "denied",
    "unavailable",
    "failed",
    "noStreetAddress",
  ] as const) {
    for (const language of LANGUAGES) {
      const voting = translateApp(language, `address.${reason}`);
      const news = translateApp(language, `address.news.${reason}`);
      assert.match(voting, registration, `voting ${reason}: ${language}`);
      assert.doesNotMatch(news, registration, `news ${reason}: ${language}`);
    }
  }
});

void test("the location draft notice names the action the person still has to take", () => {
  for (const language of LANGUAGES) {
    const save = translateApp(language, "common.save");
    assert.ok(
      translateApp(language, "address.checkDraft", { action: save }).includes(
        save,
      ),
      language,
    );
  }
});

void test("the guide labels generic rows as deadlines to check, not dates", () => {
  for (const language of LANGUAGES) {
    const heading = translateApp(language, "voteGuide.dates");
    assert.match(heading, /DEADLINE|FECHAS LÍMITE|截止/, language);
  }
});
