import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  applyCardTranslation,
  cardTranslationRequest,
  localizeContentCards,
} from "./card-translation";
import {
  CARD_TRANSLATION_PROMPT_VERSION,
  hashSegments,
  translateSegments,
  TRANSLATION_PROMPT_VERSION,
  translationPromptVersion,
} from "./content-translation";

const card = {
  id: "fa107d14-8165-482c-acc4-d1938af4c215",
  type: "bill" as const,
  title: "Wildfire.",
  description:
    "California would create rules for wildfire data sharing and let researchers see insurance data.",
  billNumber: "CA SB 492 (2025-2026)",
  sponsor: "Josh Becker (D-13)",
  imageUri: "https://example.com/image.jpg",
};

void test("the screenshot's card gets a Chinese title and summary without changing identity", () => {
  const display = applyCardTranslation(card, {
    "card.title": "野火",
    "card.description":
      "加利福尼亚州拟制定野火数据共享规则，并允许研究人员查看保险数据。",
    "card.sponsor": "invented",
  });
  assert.equal(display.translationState, "translated");
  assert.match(display.title, /野火/);
  assert.match(display.description, /拟制定/);
  assert.equal(display.id, card.id);
  assert.equal(display.billNumber, card.billNumber);
  assert.equal(display.sponsor, card.sponsor);
  assert.equal(display.imageUri, card.imageUri);
  assert.equal(card.title, "Wildfire.");
});

void test("card jobs cannot evict reader jobs; source edits invalidate the card revision", () => {
  const request = cardTranslationRequest(card, "zh");
  assert.notEqual(request.contentId, card.id);
  assert.equal(request.contentId, cardTranslationRequest(card, "es").contentId);
  assert.deepEqual(
    request.segments.map((x) => x.key),
    ["card.title", "card.description"],
  );
  const edited = cardTranslationRequest(
    { ...card, description: "Changed rule" },
    "zh",
  );
  assert.equal(request.contentId, edited.contentId);
  assert.notEqual(
    hashSegments(request.segments),
    hashSegments(edited.segments),
  );
  assert.notEqual(
    request.contentId,
    cardTranslationRequest({ ...card, featureTakeaway: "Why it matters" }, "zh")
      .contentId,
  );
});

void test("missing or partial translations remain explicitly pending, including the featured takeaway", () => {
  for (const payload of [
    null,
    { "card.title": "野火" },
    { "card.title": "野火", "card.description": " " },
  ] as (Record<string, string> | null)[]) {
    assert.equal(
      applyCardTranslation(card, payload).translationState,
      "pending",
    );
    assert.equal(applyCardTranslation(card, payload).title, card.title);
  }
  const featured = { ...card, featureTakeaway: "Why it matters" };
  assert.equal(
    applyCardTranslation(featured, {
      "card.title": "野火",
      "card.description": "摘要",
    }).translationState,
    "pending",
  );
  assert.equal(
    applyCardTranslation(featured, {
      "card.title": "野火",
      "card.description": "摘要",
      "card.featureTakeaway": "影响",
    }).featureTakeaway,
    "影响",
  );
});

void test("English uses the original record without requiring a translation database", async () => {
  assert.deepEqual(await localizeContentCards([card], "en"), [
    { ...card, translationState: "original" },
  ]);
});

void test("card prompt context is scoped; existing reader hashes stay unchanged", async () => {
  const reader = [{ key: "title", text: "Wildfire" }];
  assert.equal(
    hashSegments(reader),
    createHash("sha256")
      .update(TRANSLATION_PROMPT_VERSION)
      .update(JSON.stringify(reader))
      .digest("hex"),
  );
  const cardSegments = cardTranslationRequest(card, "zh").segments;
  assert.equal(
    translationPromptVersion(cardSegments),
    CARD_TRANSLATION_PROMPT_VERSION,
  );
  assert.notEqual(
    hashSegments(cardSegments),
    createHash("sha256")
      .update(TRANSLATION_PROMPT_VERSION)
      .update(JSON.stringify(cardSegments))
      .digest("hex"),
  );
  await translateSegments(cardSegments, "zh", (texts, language, context) => {
    assert.equal(language, "zh");
    assert.equal(context, "card");
    return Promise.resolve(texts);
  });
  await translateSegments(reader, "zh", (texts, _language, context) => {
    assert.equal(context, undefined);
    return Promise.resolve(texts);
  });
});
