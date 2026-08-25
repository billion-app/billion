import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTENT_IMAGE_STYLE_VERSION,
  contentVisualPlanningPrompt,
  renderContentImagePrompt,
  versionContentImageHash,
} from "./content-image-visual.js";

const source = {
  title: "Digital Asset Market Clarity Act",
  description:
    "This bill creates clear rules for crypto trading and hands oversight to new regulators.",
};

test("the planner sees the source copy but tells the model to translate it into a scene", () => {
  const prompt = contentVisualPlanningPrompt(source);

  assert.match(prompt, /Digital Asset Market Clarity Act/);
  assert.match(prompt, /crypto trading/);
  assert.match(prompt, /Translate the policy into a scene, not a poster/);
});

test("the FLUX prompt contains only the visual plan, never the bill title or summary", () => {
  const prompt = renderContentImagePrompt({
    scene:
      "A bustling exchange built from translucent coins, with ordinary traders crossing bright guardrails while two watchful civic stewards balance the market on an enormous brass scale",
  });

  assert.doesNotMatch(prompt, /Digital Asset Market Clarity Act/);
  assert.doesNotMatch(prompt, /This bill creates clear rules/);
  assert.match(prompt, /^NO WORDS OR TYPOGRAPHY/);
  assert.match(prompt, /imaginative editorial illustration/);
  assert.match(prompt, /every other surface that would normally carry writing/);
  assert.match(prompt, /blank and unmarked/);
  assert.match(prompt, /No letters, words, numerals/);
});

test("a visual plan containing written material is rejected", () => {
  assert.throws(
    () =>
      renderContentImagePrompt({
        scene:
          'A glowing coin market beneath a sign reading "CLARITY", watched by regulators',
      }),
    /includes written material/,
  );
});

test("the style version makes old documentary rows stale", () => {
  assert.equal(
    versionContentImageHash("bill-hash"),
    `${CONTENT_IMAGE_STYLE_VERSION}:bill-hash`,
  );
});
