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
  fullText: "A normal source sentence with enough context. ".repeat(20),
  aiGeneratedArticle: article,
  videoId: "video-id",
  videoImageData: Buffer.from("image"),
  videoThumbnailUrl: null,
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
    needsReprocessing({ ...completeState, videoImageData: null }, "missing"),
    true,
  );
  assert.equal(needsReprocessing(completeState, "replace"), true);
  assert.equal(
    needsReprocessing({ ...completeState, fullText: null }, "missing"),
    true,
  );
});
