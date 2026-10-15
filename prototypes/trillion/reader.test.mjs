// Run: node --test prototypes/trillion/reader.test.mjs
// Exercises the same engine that ships in the Expo DOM component.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";

await test("Trillion cards, touch ring and device persistence", async () => {
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(`.${new URL(req.url, "http://localhost").pathname}`);
      const content = await readFile(path);
      res.setHeader(
        "Content-Type",
        path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      res.end(content);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 430, height: 932 },
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.abort(),
    );
    await page.goto(
      `http://127.0.0.1:${server.address().port}/prototypes/trillion/mobile.html`,
    );
    await page.locator('[data-measure="41"]').click();
    await page.locator(".pinned-dispute").waitFor();
    assert.equal(
      await page
        .locator(
          '.pinned-dispute [role="button"], .pinned-dispute [role="link"]',
        )
        .count(),
      0,
      "card titles cannot contain competing actions",
    );
    await page.locator(".pd-title").click();
    assert.match(
      await page.locator("#page h1").textContent(),
      /Would audits improve public services/,
    );
    await page.locator("[data-save]").click();
    assert.equal(
      await page.locator("[data-save]").getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("[data-flag]").click();
    await page.locator('[data-fault="Does not follow"]').click();
    assert.match(
      await page.locator("[data-flag]").textContent(),
      /Does not follow/,
    );
    await page.locator("#back").click();
    assert.match(
      await page.locator(".saved-arguments").textContent(),
      /Would audits/,
    );
    await page.locator('[data-measure="40"]').click();
    await page.locator('[data-measure="41"]').click();
    await page.locator(".saved-arguments [data-node]").click();
    assert.equal(
      await page.locator("[data-save]").getAttribute("aria-pressed"),
      "true",
    );
    assert.match(
      await page.locator("[data-flag]").textContent(),
      /Does not follow/,
    );
    await page.locator('[data-measure="40"]').click();
    await page.locator('[data-tab="disagree"]').first().click();
    assert.match(
      await page.locator(".values-dispute").first().textContent(),
      /Values debate/,
    );
    await page.locator(".values-dispute [data-node]").first().click();
    assert.match(
      await page.locator(".focus .kind").textContent(),
      /Values debate/,
    );
    await page
      .locator(".rows .go", { hasText: "ten months before the vote" })
      .click();
    assert.equal(
      await page.locator(".evidence-warning").first().textContent(),
      "No source quote",
    );
    await page.locator('[data-measure="41"]').click();
    await page.locator('[data-view="map"]').first().click();
    await page.locator("#map-ring").click();
    const slice = page.locator(".ring-sheet svg [data-peek]").first();
    await slice.focus();
    assert.doesNotMatch(
      await page.locator("#ov-hover").textContent(),
      /Drag over/,
    );
    await page.keyboard.press("Enter");
    assert.notEqual(
      await page.locator("#sheet-title").textContent(),
      "The whole debate",
    );
    await page.locator("[data-ring]").click();
    const scrubbedTitle = await page
      .locator(".ring-sheet svg")
      .evaluate((svg) => {
        const el = svg.querySelector("[data-peek]");
        el.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            clientX: 200,
            clientY: 300,
          }),
        );
        const next = svg.querySelectorAll("path[data-peek]")[1];
        const point = next
          .getPointAtLength(next.getTotalLength() * 0.2)
          .matrixTransform(next.getScreenCTM());
        el.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: point.x,
            clientY: point.y,
            pointerType: "touch",
          }),
        );
        const title = next.querySelector("title").textContent;
        el.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            clientX: 230,
            clientY: 300,
          }),
        );
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return title;
      });
    assert.ok(
      (await page.locator("#ov-hover").textContent()).includes(scrubbedTitle),
      "touch movement names the slice under the finger",
    );
    assert.equal(
      await page.locator("#sheet-title").textContent(),
      "The whole debate",
      "scrubbing must leave the ring open",
    );
    await slice.dispatchEvent("click");
    assert.notEqual(
      await page.locator("#sheet-title").textContent(),
      "The whole debate",
    );
    await page.locator("[data-close]").first().click();
    await page.locator(".saved-arguments [data-node]").click();
    await page.locator("[data-save]").click();
    assert.equal(
      await page.locator("[data-save]").getAttribute("aria-pressed"),
      "false",
    );
    await page.locator("[data-flag]").click();
    await page.locator('[data-fault="Clear flag"]').click();
    assert.match(
      await page.locator("[data-flag]").textContent(),
      /Flag an argument fault/,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
