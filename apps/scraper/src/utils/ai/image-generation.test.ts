import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import sharp from "sharp";

const keys = [
  "SCRAPER_IMAGE_PROVIDER",
  "SCRAPER_IMAGE_MODEL",
  "SCRAPER_FALLBACK_BASE_URL",
  "SCRAPER_FALLBACK_API_KEY",
  "LOCAL_FLUX_BASE_URL",
];
let sequence = 0;
async function setup(t: TestContext, environment: Record<string, string>) {
  const before = { ...process.env };
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, environment);
  t.after(() => {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });
  return import(`./image-generation.ts?test=${sequence++}`);
}
async function png() {
  return sharp({
    create: { width: 24, height: 16, channels: 3, background: "#446688" },
  })
    .png()
    .toBuffer();
}
const codex = {
  SCRAPER_IMAGE_PROVIDER: "codex",
  SCRAPER_FALLBACK_BASE_URL: "http://codex.test/v1",
  LOCAL_FLUX_BASE_URL: "http://local.test",
};

test("Codex header generation uses the subscription endpoint and actual image dimensions", async (t) => {
  const provider = await setup(t, codex);
  const data = await png();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls += 1;
    assert.equal(String(url), "http://codex.test/v1/images/generations");
    const body = JSON.parse(init.body as string);
    assert.equal(body.model, "gpt-image-2");
    assert.equal(body.prompt, "A calm civic scene");
    assert.equal(body.n, 1);
    assert.equal(body.quality, "low");
    assert.equal(body.size, "1536x1024");
    return Response.json({ data: [{ b64_json: data.toString("base64") }] });
  });
  const result = await provider.generateEditorialImage("A calm civic scene");
  assert.equal(calls, 1);
  assert.equal(result?.width, 24);
  assert.equal(result?.height, 16);
  assert.deepEqual(result?.data, data);
});

test("Codex outage falls back to local generation without a hosted-image request", async (t) => {
  const provider = await setup(t, codex);
  const calls: string[] = [];
  const data = await png();
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("codex.test"))
      return new Response("unavailable", { status: 503 });
    assert.equal(String(url), "http://local.test/generate");
    return new Response(data, { headers: { "content-type": "image/png" } });
  });
  assert.ok(await provider.generateEditorialImage("A calm civic scene"));
  assert.deepEqual(calls, [
    "http://codex.test/v1/images/generations",
    "http://local.test/generate",
  ]);
});

test("invalid Codex image bytes are not returned as a successful generation", async (t) => {
  const provider = await setup(t, { ...codex, LOCAL_FLUX_BASE_URL: "" });
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      data: [{ b64_json: Buffer.from("not an image").toString("base64") }],
    }),
  );
  assert.equal(
    await provider.generateEditorialImage("A calm civic scene"),
    null,
  );
});

test("Codex imagery requires its endpoint", async (t) => {
  const provider = await setup(t, { SCRAPER_IMAGE_PROVIDER: "codex" });
  await assert.rejects(
    provider.generateEditorialImage("A calm civic scene"),
    /SCRAPER_FALLBACK_BASE_URL is required/,
  );
});

test("a moderated Codex request never activates another image provider", async (t) => {
  const provider = await setup(t, codex);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return Response.json(
      { error: { code: "content_policy_violation" } },
      { status: 400 },
    );
  });
  assert.equal(await provider.generateEditorialImage("A civic scene"), null);
  assert.equal(calls, 1);
});
