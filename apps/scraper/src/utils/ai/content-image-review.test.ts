import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import type { GeneratedImage } from "./image-generation.js";
import {
  contentImageReviewPrompt,
  generateContentImage,
  generateReviewedContentImage,
  missingSourceDescriptionReview,
  reviewContentImage,
} from "./content-image-review.js";

const source = {
  title: "Clean Water Infrastructure Act",
  description:
    "This bill funds lead-pipe replacement and requires public water systems to test for lead.",
};

async function image(): Promise<GeneratedImage> {
  const data = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 40, g: 90, b: 120 },
    },
  })
    .png()
    .toBuffer();
  return { data, mimeType: "image/png", width: 1200, height: 800 };
}

function acceptedReview() {
  return {
    decision: "accept" as const,
    description:
      "A calm infrastructure scene shows workers replacing a pipe beside a water main.",
    rejectionReasons: [],
  };
}

function rejectedReview(feedback: string) {
  return {
    decision: "reject" as const,
    description:
      "The scene adds a dramatic figure and the subject is unclear in the centered crops.",
    rejectionReasons: ["unclear-subject" as const, "sensationalism" as const],
    feedback,
  };
}

test("a rejected image is regenerated once with the review feedback", async () => {
  const generated = await image();
  const feedbacks: Array<string | undefined> = [];
  let reviewCalls = 0;

  const result = await generateReviewedContentImage({
    source,
    generate: async (feedback) => {
      feedbacks.push(feedback);
      return { image: generated, prompt: `prompt-${feedback ?? "first"}` };
    },
    review: async () => {
      reviewCalls += 1;
      return reviewCalls === 1
        ? rejectedReview("Keep the water infrastructure as the clear subject.")
        : acceptedReview();
    },
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.reviewAttempts, 2);
  assert.deepEqual(feedbacks, [
    undefined,
    "Keep the water infrastructure as the clear subject.",
  ]);
});

test("an exhausted rejection returns no publishable image", async () => {
  const generated = await image();
  let generatedCount = 0;
  let reviewCount = 0;

  const result = await generateReviewedContentImage({
    source,
    generate: async () => {
      generatedCount += 1;
      return { image: generated, prompt: "prompt" };
    },
    review: async () => {
      reviewCount += 1;
      return rejectedReview("Remove the sensational framing.");
    },
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.reviewAttempts, 2);
  assert.equal(generatedCount, 2);
  assert.equal(reviewCount, 2);
  assert.equal("generated" in result, false);
});

test("review errors never become an accepted result", async () => {
  const generated = await image();
  const result = await generateReviewedContentImage({
    source,
    generate: async () => ({ image: generated, prompt: "prompt" }),
    review: async () => {
      throw new Error("DeepSeek unavailable");
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.reviewAttempts, 0);
});

test("review can be explicitly bypassed without calling the reviewer", async () => {
  const generated = await image();
  let reviewCalls = 0;
  const result = await generateContentImage({
    source,
    skipReview: true,
    generate: async () => ({ image: generated, prompt: "prompt" }),
    review: async () => {
      reviewCalls += 1;
      throw new Error("review must not run");
    },
  });

  assert.equal(result.status, "unreviewed");
  assert.equal(reviewCalls, 0);
  if (result.status === "unreviewed") {
    assert.equal(result.generated.prompt, "prompt");
  }
});

test("a missing source description is rejected before generation", () => {
  const review = missingSourceDescriptionReview({
    title: source.title,
    description: "  ",
  });

  assert.equal(review?.decision, "reject");
  assert.deepEqual(review?.rejectionReasons, [
    "insufficient-source-description",
  ]);
  assert.equal(missingSourceDescriptionReview(source), null);
});

test("the direct DeepSeek review sends the wide and square app crops", async () => {
  const generated = await image();
  let requestBody: unknown;
  const response = await reviewContentImage(generated, source, {
    apiKey: "test-key",
    local: null,
    fetch: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(acceptedReview()),
              },
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const { reviewModelVersion, ...review } = response;
  assert.deepEqual(review, acceptedReview());
  assert.equal(reviewModelVersion, "deepseek:deepseek-v4-flash-vision-exp");
  const content = (
    requestBody as {
      model: string;
      messages: Array<{
        content: Array<{
          type: string;
          text?: string;
          image_url?: { url: string; detail?: string };
        }>;
      }>;
    }
  ).messages[0]?.content;
  assert.equal(
    (requestBody as { model: string }).model,
    "deepseek-v4-flash-vision-exp",
  );
  assert.equal(content?.filter((part) => part.type === "image_url").length, 2);
  const imageParts = content?.filter((part) => part.type === "image_url") ?? [];
  for (const part of imageParts) {
    const dataUrl = part.image_url?.url ?? "";
    assert.match(dataUrl, /^data:image\/jpeg;base64,/);
    assert.equal(part.image_url?.detail, "high");
    const [, base64] = dataUrl.split(",", 2);
    assert.ok(base64);
    const metadata = await sharp(Buffer.from(base64, "base64")).metadata();
    assert.ok(metadata.width && metadata.height);
    assert.ok(
      Math.abs(
        metadata.width / metadata.height -
          (imageParts.indexOf(part) === 0 ? 2 : 1),
      ) < 0.01,
    );
  }
  assert.match(
    content?.find((part) => part.type === "text")?.text ?? "",
    /actual.*crop/i,
  );
  assert.match(contentImageReviewPrompt(source), /wide centered crop/);
  assert.match(contentImageReviewPrompt(source), /square centered crop/);
});

test("image review prefers the configured local model without hidden reasoning", async () => {
  const generated = await image();
  const requests: Array<{
    url: string;
    body: { model?: string; reasoning_effort?: string };
  }> = [];
  const response = await reviewContentImage(generated, source, {
    apiKey: "deepseek-test-key",
    local: {
      baseURL: "http://local.test/v1",
      model: "local-vision",
      apiKey: "local-test-key",
    },
    fetch: async (url, init) => {
      requests.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as {
          model?: string;
          reasoning_effort?: string;
        },
      });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  decision: "accept",
                  description:
                    "A restrained editorial scene remains clear in both crops.",
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://local.test/v1/chat/completions");
  assert.equal(requests[0]?.body.model, "local-vision");
  assert.equal(requests[0]?.body.reasoning_effort, "none");
  assert.deepEqual(response.rejectionReasons, []);
  assert.equal(response.reviewModelVersion, "local:local-vision");
});

test("image review falls back to DeepSeek when the local model fails", async () => {
  const generated = await image();
  const requests: string[] = [];
  const response = await reviewContentImage(generated, source, {
    apiKey: "deepseek-test-key",
    local: {
      baseURL: "http://local.test/v1",
      model: "local-vision",
      apiKey: "local-test-key",
    },
    fetch: async (url) => {
      requests.push(String(url));
      if (String(url).startsWith("http://local.test")) {
        return new Response("local unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(acceptedReview()) } }],
        }),
        { status: 200 },
      );
    },
  });

  assert.deepEqual(requests, [
    "http://local.test/v1/chat/completions",
    "https://api.deepseek.com/chat/completions",
  ]);
  assert.equal(
    response.reviewModelVersion,
    "deepseek:deepseek-v4-flash-vision-exp",
  );
});

test("malformed DeepSeek review JSON fails closed", async () => {
  const generated = await image();
  await assert.rejects(
    reviewContentImage(generated, source, {
      apiKey: "test-key",
      local: null,
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"decision":"accept"}' } }],
          }),
          { status: 200 },
        ),
    }),
    /schema validation/,
  );
});

test("invalid DeepSeek HTTP responses fail closed", async () => {
  const generated = await image();
  await assert.rejects(
    reviewContentImage(generated, source, {
      apiKey: "test-key",
      local: null,
      fetch: async () => new Response("upstream unavailable", { status: 503 }),
    }),
    /failed \(503\)/,
  );
});

test("contradictory accept payloads fail schema validation", async () => {
  const generated = await image();
  await assert.rejects(
    reviewContentImage(generated, source, {
      apiKey: "test-key",
      local: null,
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ...acceptedReview(),
                    rejectionReasons: ["artifacts"],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
    }),
    /schema validation/,
  );
});

test("rejections without an explicit reason fail schema validation", async () => {
  const generated = await image();
  await assert.rejects(
    reviewContentImage(generated, source, {
      apiKey: "test-key",
      local: null,
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    decision: "reject",
                    description:
                      "The subject is not suitable for the source material.",
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
    }),
    /at least one explicit reason/,
  );
});
