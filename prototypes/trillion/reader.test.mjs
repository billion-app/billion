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
    await page.locator('[data-tab="disagree"]').first().click();
    await page.locator(".dispute-row").first().waitFor();
    assert.equal(
      await page
        .locator(
          '.dispute-row .go [role="button"], .dispute-row .go [role="link"]',
        )
        .count(),
      0,
      "card titles cannot contain competing actions",
    );
    await page.locator(".dispute-row .go").first().click();
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
    const inlineAll = page.locator("#page > .map-show-all [data-map-show-all]");
    const focusedCount = await page.locator(".mcard.lit").count();
    assert.equal(await inlineAll.isChecked(), false);
    await inlineAll.focus();
    await page.keyboard.press("Space");
    const allCount = await page.locator(".mcard").count();
    assert.ok(
      allCount > focusedCount,
      "the fixture has arguments beyond the focused map",
    );
    assert.equal(await page.locator(".mcard.lit").count(), allCount);
    assert.equal(await page.locator(".mcard.hint").count(), 0);
    assert.equal(await page.locator("#map-more").isVisible(), false);
    await page.locator('[data-tab="disagree"]').first().click();
    assert.equal(await inlineAll.isChecked(), true);
    assert.equal(await page.locator(".mcard.lit").count(), allCount);
    await page.locator("#map-expand").click();
    const fullAll = page.locator(".map-full-head [data-map-show-all]");
    assert.equal(await fullAll.isChecked(), true);
    const geometry = await page.locator("#cy").evaluate((el) => {
      const cy = el._cyreg.cy;
      const viewport = el.getBoundingClientRect();
      const cards = [...document.querySelectorAll(".mcard")];
      return cy.nodes().map((node, index) => {
        const card = cards[index].getBoundingClientRect();
        const point = node.renderedPosition();
        return {
          id: node.id(),
          error: Math.hypot(
            card.x + card.width / 2 - viewport.x - point.x,
            card.y + card.height / 2 - viewport.y - point.y,
          ),
        };
      });
    });
    assert.ok(
      geometry.every((node) => node.error < 1),
      `cards and their connection geometry must align: ${JSON.stringify(geometry.filter((node) => node.error >= 1))}`,
    );
    assert.equal(await page.locator("#map-hint").isVisible(), true);
    assert.equal(
      await page.locator(".mcard.lit .mtitle").first().isVisible(),
      false,
      "overview must not render microscopic text",
    );
    await page.locator("#zoom-in").click();
    await page.waitForFunction(
      () => !document.querySelector("#map").classList.contains("overview"),
    );
    assert.equal(
      await page.locator(".mcard.lit .mtitle").first().isVisible(),
      true,
    );
    const renderedFont = await page
      .locator(".mcard.lit .mtitle")
      .first()
      .evaluate(
        (title) =>
          parseFloat(getComputedStyle(title).fontSize) *
          document.querySelector("#cy")._cyreg.cy.zoom(),
      );
    assert.ok(
      renderedFont >= 12,
      "labels must be readable immediately after leaving overview",
    );
    const overlapCount = await page.locator("#cy").evaluate((el) => {
      const nodes = el._cyreg.cy.nodes();
      let overlaps = 0;
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          if (
            Math.abs(a.position("x") - b.position("x")) <
              (a.width() + b.width()) / 2 &&
            Math.abs(a.position("y") - b.position("y")) <
              (a.height() + b.height()) / 2
          )
            overlaps++;
        }
      return overlaps;
    });
    assert.equal(
      overlapCount,
      0,
      "repulsion must keep readable argument cards apart",
    );
    await page.locator("#zoom-fit").click();
    await page.waitForFunction(
      () => !document.querySelector("#cy")._cyreg.cy.animated(),
    );
    const drag = await page.locator("#cy").evaluate((el) => {
      const cy = el._cyreg.cy;
      const rect = el.getBoundingClientRect();
      const nodes = cy.nodes().filter((node) => {
        const p = node.renderedPosition();
        return (
          p.x + rect.x > 25 &&
          p.x + rect.x < innerWidth - 25 &&
          p.y + rect.y > rect.y + 25 &&
          p.y + rect.y < rect.bottom - 120
        );
      });
      const node = nodes[0],
        neighbor = nodes[1];
      const point = node.renderedPosition(),
        target = neighbor.renderedPosition();
      return {
        id: node.id(),
        neighborId: neighbor.id(),
        before: { ...node.position() },
        neighborBefore: { ...neighbor.position() },
        x: point.x + rect.x,
        y: point.y + rect.y,
        targetX: target.x + rect.x,
        targetY: target.y + rect.y,
      };
    });
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.targetX, drag.targetY, { steps: 12 });
    await page.waitForFunction(({ id, neighborId, before, neighborBefore }) => {
      const cy = document.querySelector("#cy")._cyreg.cy;
      const node = cy.getElementById(id).position();
      const neighbor = cy.getElementById(neighborId).position();
      return (
        Math.hypot(node.x - before.x, node.y - before.y) > 20 &&
        Math.hypot(
          neighbor.x - neighborBefore.x,
          neighbor.y - neighborBefore.y,
        ) > 1
      );
    }, drag);
    await page.mouse.up();
    await page.waitForFunction(() => {
      const nodes = document.querySelector("#cy")._cyreg.cy.nodes();
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          if (
            Math.abs(a.position("x") - b.position("x")) <
              (a.data("fw") + b.data("fw")) / 2 &&
            Math.abs(a.position("y") - b.position("y")) <
              (a.data("fh") + b.data("fh")) / 2
          )
            return false;
        }
      return true;
    });
    await fullAll.uncheck();
    assert.ok((await page.locator(".mcard.lit").count()) < allCount);
    await page.locator("#map-close").click();
    assert.equal(await inlineAll.isChecked(), false);
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
    // The demo page also scrolls outside the phone; bring the touch target into view.
    await page.locator(".ring-sheet svg").scrollIntoViewIfNeeded();
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
