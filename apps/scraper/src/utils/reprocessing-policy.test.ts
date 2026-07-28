import assert from "node:assert/strict";
import test from "node:test";

import {
  isUsableAIArticle,
  isUsableSourceText,
  needsReprocessing,
} from "./reprocessing-policy.js";

const article = `
## What This Means For You
${"Practical impact. ".repeat(20)}
## Overview
${"Balanced context. ".repeat(20)}
## Impact & Implications
${"Specific effects. ".repeat(20)}
## The Debate
${"Supporters and critics disagree. ".repeat(20)}
`;

const completeState = {
  contentType: "court_case" as const,
  fullText: "A normal source sentence with enough context. ".repeat(20),
  aiGeneratedArticle: article,
  hasBrief: false,
  videoId: "video-id",
  videoHasImage: true,
  videoThumbnailUrl: null,
};

/** A bill stored the way the scraper now stores them: brief, no article. */
const completeBill = {
  ...completeState,
  contentType: "bill" as const,
  aiGeneratedArticle: null,
  hasBrief: true,
};

void test("source text rejects short and boilerplate-heavy input", () => {
  assert.equal(isUsableSourceText("too short"), false);
  assert.equal(
    isUsableSourceText("HEADER\nONE\nTWO\nTHREE\n" + "body text ".repeat(30)),
    false,
  );
  assert.equal(isUsableSourceText(completeState.fullText), true);
});

void test("AI article requires all expected sections", () => {
  assert.equal(isUsableAIArticle(article), true);
  assert.equal(
    isUsableAIArticle(article.replace("## The Debate", "## Notes")),
    false,
  );
});

void test("missing mode selects incomplete derived assets only", () => {
  assert.equal(needsReprocessing(completeState, "missing"), false);
  assert.equal(
    needsReprocessing({ ...completeState, videoHasImage: false }, "missing"),
    true,
  );
  assert.equal(needsReprocessing(completeState, "replace"), true);
  assert.equal(
    needsReprocessing({ ...completeState, fullText: null }, "missing"),
    true,
  );
});

void test("a bill is judged on its brief, not on the retired article", () => {
  // The trap this guards: bills no longer generate an article, so requiring one
  // would mark every correctly-stored bill incomplete and regenerate the exact
  // artifact that was deliberately removed — on every run, forever.
  assert.equal(needsReprocessing(completeBill, "missing"), false);
  assert.equal(
    needsReprocessing({ ...completeBill, hasBrief: false }, "missing"),
    true,
  );
});

void test("a bill with a legacy article but no brief is still incomplete", () => {
  // Describes the 794 bills in production carrying an article and no brief:
  // they render as a wall of prose, which is the state being drained.
  assert.equal(
    needsReprocessing(
      { ...completeBill, aiGeneratedArticle: article, hasBrief: false },
      "missing",
    ),
    true,
  );
});

void test("non-bill types still require an article, having no brief schema", () => {
  for (const contentType of ["government_content", "court_case"] as const) {
    assert.equal(
      needsReprocessing({ ...completeState, contentType }, "missing"),
      false,
    );
    assert.equal(
      needsReprocessing(
        { ...completeState, contentType, aiGeneratedArticle: null },
        "missing",
      ),
      true,
      `${contentType} should still need its article`,
    );
  }
});

void test("missing source text or header art outranks the long-form check", () => {
  // Both apply to every type, so a bill with a perfect brief still needs work
  // if its art is gone.
  assert.equal(
    needsReprocessing({ ...completeBill, videoHasImage: false }, "missing"),
    true,
  );
  assert.equal(
    needsReprocessing({ ...completeBill, fullText: null }, "missing"),
    true,
  );
});
