import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTENT_IMAGE_STYLE_VERSION,
  contentImageReviewStyleVersion,
  contentVisualPlanningPrompt,
  governmentImageDescription,
  planRenderedContentImagePrompt,
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
  assert.match(
    prompt,
    /Translate the policy into one literal, documentary-like scene/,
  );
  assert.match(prompt, /at least three concrete, recognizable objects/);
  assert.match(prompt, /Do not invent policy consequences/);
});

test("the FLUX prompt contains only the visual plan, never the bill title or summary", () => {
  const prompt = renderContentImagePrompt({
    scene:
      "A bustling exchange built from translucent coins, with ordinary traders crossing bright guardrails while two watchful civic stewards balance the market on an enormous brass scale",
  });

  assert.doesNotMatch(prompt, /Digital Asset Market Clarity Act/);
  assert.doesNotMatch(prompt, /This bill creates clear rules/);
  assert.match(prompt, /^NO WORDS OR TYPOGRAPHY/);
  assert.match(prompt, /professional editorial illustration/);
  assert.match(prompt, /restrained, literal composition/);
  assert.match(prompt, /Every visible surface/);
  assert.match(prompt, /blank and unmarked/);
  assert.match(prompt, /No readable writing, letters, words, numerals/);
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

test("invalid visual plans are retried before the image job fails", async () => {
  let attempts = 0;
  const prompt = await planRenderedContentImagePrompt(source, async () => {
    attempts += 1;
    return attempts < 3
      ? { scene: "A courthouse screen covered in words" }
      : {
          scene:
            "A brass market scale balancing luminous coins while civic stewards guide traders through bright guardrails",
        };
  });

  assert.equal(attempts, 3);
  assert.match(prompt, /brass market scale/);
});

test("revision feedback is passed to the next visual planning attempt", async () => {
  const prompt = contentVisualPlanningPrompt(
    source,
    "remove the dramatic villain",
  );

  assert.match(prompt, /REVISION GUIDANCE/);
  assert.match(prompt, /remove the dramatic villain/);
});

test("the style version makes old documentary rows stale", () => {
  const versioned = versionContentImageHash("bill-hash");

  assert.match(versioned, /^[a-f0-9]{32}$/);
  assert.notEqual(versioned, "bill-hash");
  assert.equal(versioned, versionContentImageHash("bill-hash"));
  assert.notEqual(versioned, versionContentImageHash("different-bill-hash"));
});

test("government artwork uses bounded policy text rather than page navigation", () => {
  const result = governmentImageDescription(
    "Fight invasive pests.",
    "Search All Presidential Actions\nSection 1. Purpose. Control disease-carrying ticks and mosquitoes. " +
      "policy ".repeat(1000),
  );
  assert.match(result, /Fight invasive pests/);
  assert.match(result, /ticks and mosquitoes/);
  assert.doesNotMatch(result, /Search All Presidential Actions/);
  assert.ok(result.length < 1200);
});

test("source excerpts cannot replace a missing neutral summary", () => {
  assert.equal(
    governmentImageDescription(" ", "Section 1. Purpose. Policy text."),
    "",
  );
  assert.equal(
    governmentImageDescription("A neutral summary.", null),
    "A neutral summary.",
  );
  assert.equal(
    governmentImageDescription("A neutral summary.", "Search navigation"),
    "A neutral summary.",
  );
});

test("a scene excluding written material is safe to render", () => {
  const prompt = renderContentImagePrompt({
    scene:
      "A public library entrance with brick arches and bicycles, no signs, text or logos anywhere",
  });
  assert.match(prompt, /public library entrance/);
});

test("plural written objects are rejected even beside an exclusion", () => {
  assert.throws(
    () =>
      renderContentImagePrompt({
        scene:
          "A courthouse with no logos, and signs announcing the new policy",
      }),
    /includes written material/,
  );
});

test("planning retries include the validation failure and preserve review guidance", async () => {
  const feedbacks: Array<string | undefined> = [];
  await planRenderedContentImagePrompt(
    source,
    async (_source, feedback) => {
      feedbacks.push(feedback);
      return feedbacks.length === 1
        ? { scene: "A city street with signs announcing new rules" }
        : { scene: "A city street with brick homes, trees and bicycles" };
    },
    3,
    "Keep the homes prominent",
  );
  assert.equal(feedbacks[0], "Keep the homes prominent");
  assert.match(feedbacks[1]!, /Keep the homes prominent/);
  assert.match(feedbacks[1]!, /includes written material/);
});

test("a provider switch retries old rejections without making accepted image hashes stale", (t) => {
  const before = {
    provider: process.env.SCRAPER_IMAGE_PROVIDER,
    model: process.env.SCRAPER_IMAGE_MODEL,
  };
  t.after(() => {
    for (const [key, value] of [
      ["SCRAPER_IMAGE_PROVIDER", before.provider],
      ["SCRAPER_IMAGE_MODEL", before.model],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  });
  delete process.env.SCRAPER_IMAGE_PROVIDER;
  const hash = versionContentImageHash("source");
  assert.equal(contentImageReviewStyleVersion(), CONTENT_IMAGE_STYLE_VERSION);
  process.env.SCRAPER_IMAGE_PROVIDER = "codex";
  process.env.SCRAPER_IMAGE_MODEL = "gpt-image-2";
  assert.equal(
    contentImageReviewStyleVersion(),
    `${CONTENT_IMAGE_STYLE_VERSION}:codex:gpt-image-2`,
  );
  assert.equal(versionContentImageHash("source"), hash);
});

test("a source-grounded reading activity with blank learning materials is drawable", () => {
  assert.doesNotThrow(() =>
    renderContentImagePrompt({
      scene:
        "In a public library, a child and adult share a reading activity with an open picture book and colored reading guides. All pages are blank and unmarked, with no visible writing or printed symbols.",
    }),
  );
});

test("blank source-related surfaces do not become requests for readable copy", () => {
  assert.doesNotThrow(() =>
    renderContentImagePrompt({
      scene:
        "A service plaza with a blank sign beside fuel pumps; an inspector examines an unmarked document, without any printed text or visible logos.",
    }),
  );
});

test("explicit readable copy remains forbidden even when other writing is excluded", () => {
  for (const scene of [
    "A library with a sign reading CLARITY, no logos",
    "A city poster with a headline announcing the new policy",
    "A courthouse screen covered in words",
    "Children arrange wooden letter-shaped blocks",
    "A fuel pump with readable prices and numerals",
    "A roadside sign that reads STOP beside a red truck",
    "A courthouse banner bearing JUSTICE FOR ALL above the entrance",
    "A street with no logos, and signs that read STOP",
  ]) {
    assert.throws(
      () => renderContentImagePrompt({ scene }),
      /includes written material/,
      scene,
    );
  }
});

test("common exclusion variants do not make a fuel-pump scene fail", () => {
  for (const exclusion of [
    "no visible lettering or logos",
    "no other text or signage",
    "no readable text, logos, signs, or numbers",
    "no legible writing, numbers, logos, or symbols",
    "no display text",
  ]) {
    assert.doesNotThrow(() =>
      renderContentImagePrompt({
        scene: `A driver refuels a car beside a blank pump, ${exclusion}.`,
      }),
    );
  }
});
