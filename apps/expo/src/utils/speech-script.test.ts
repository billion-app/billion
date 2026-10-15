import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_LANGUAGES,
  languageFromLocales,
  speechLanguageTag,
} from "../i18n/language";
import { DICTIONARIES, translate } from "../i18n/strings";
import {
  buildSpeechChunks,
  buildSpeechParagraphs,
  chunkForSpeech,
  stripMarkdown,
} from "./speech-script";

void test("strips markdown syntax, links, images, and urls", () => {
  assert.equal(
    stripMarkdown(
      "## Heading\n- **Bold** item with [a link](https://x.y)\n![art](a.png) see https://example.com",
    ).trim(),
    "Heading\nBold item with a link\n  see",
  );
});

void test("reads a bill brief as prose and skips source quotes", () => {
  const paragraphs = buildSpeechParagraphs({
    title: "Road Act",
    description: "Funds roads",
    brief: {
      summary: "Gives states **ten years** of money",
      changes: [
        {
          title: "Money for states",
          before: "States apply yearly",
          after: "States get a share",
          // @ts-expect-error quotes exist on real briefs and must be ignored
          quote: { text: "shall apportion" },
        },
      ],
      unknowns: ["Who sets the formula?"],
    },
  });
  assert.deepEqual(paragraphs, [
    "Road Act.",
    "Funds roads.",
    "Gives states ten years of money.",
    "Money for states. States apply yearly. States get a share.",
    "Who sets the formula?",
  ]);
  assert.ok(!paragraphs.join(" ").includes("apportion"));
});

void test("falls back to the markdown body without a brief", () => {
  const paragraphs = buildSpeechParagraphs({
    title: "T",
    body: "# Intro\n\nFirst paragraph.\n\n* point one",
  });
  assert.deepEqual(paragraphs, [
    "T.",
    "Intro.",
    "First paragraph.",
    "point one.",
  ]);
});

void test("keeps every chunk under the limit, including Chinese", () => {
  const english = "This is a sentence. ".repeat(200);
  const chinese = "这是一个句子。".repeat(400);
  for (const text of [english, chinese, "x".repeat(5000)]) {
    const chunks = chunkForSpeech([text], 500);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 500));
  }
});

void test("packs short paragraphs together", () => {
  assert.equal(buildSpeechChunks({ title: "A", description: "B" }).length, 1);
});

void test("picks a supported device language or English", () => {
  assert.equal(languageFromLocales(["fr-FR", "es-MX"]), "es");
  assert.equal(languageFromLocales(["zh-Hans-CN"]), "zh");
  assert.equal(languageFromLocales(["de-DE"]), "en");
  assert.equal(languageFromLocales([]), "en");
  assert.equal(speechLanguageTag("zh"), "zh-CN");
});

void test("translations only use English keys and keep placeholders", () => {
  for (const language of APP_LANGUAGES) {
    for (const [key, value] of Object.entries(DICTIONARIES[language])) {
      assert.ok(key in DICTIONARIES.en, `${language} has unknown key ${key}`);
      const placeholders = (text: string) =>
        (text.match(/\{\w+\}/g) ?? []).sort().join();
      const english = DICTIONARIES.en[key as keyof typeof DICTIONARIES.en];
      assert.equal(placeholders(value), placeholders(english ?? ""), key);
    }
  }
  assert.equal(
    translate("es", "listen.progress", { current: 2, total: 5 }),
    "Parte 2 de 5",
  );
});
