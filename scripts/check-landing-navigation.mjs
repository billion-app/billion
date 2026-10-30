import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const output = process.env.OUT_DIR ?? "/tmp/billion-team-navigation";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [width, reducedMotion] of [
    [1440, "no-preference"],
    [768, "no-preference"],
    [390, "no-preference"],
    [320, "no-preference"],
    [390, "reduce"],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", { name: "Main", exact: true });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Team", exact: true }).click();
    await expect(page).toHaveURL(/#team$/);
    await expect
      .poll(
        () =>
          page
            .locator("#team")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        { timeout: 10000 },
      )
      .toBe(width <= 600 ? 64 : 72);
    await expect(
      nav.getByRole("link", { name: "Team", exact: true }),
    ).toHaveAttribute("aria-current", "location");
    assert.equal(await nav.evaluate((el) => !!el.closest("[inert]")), false);
    if (reducedMotion === "no-preference") {
      await expect(page.locator(".cinematic-stage")).toHaveAttribute(
        "inert",
        "",
      );
      await expect(page.locator(".cinematic-stage")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
    assert.equal(
      await nav.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          document
            .elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            ?.closest("header") === el.parentElement
        );
      }),
      true,
    );
    assert.deepEqual(await page.locator("#team h3").allTextContents(), [
      "Bryan Hu",
      "Jun Jiang",
      "Nacho Nandish",
      "Yohaan Narayanan",
    ]);
    assert.deepEqual(
      await page.locator(".cinematic-team-role").allTextContents(),
      ["Co-Founder", "Co-Founder", "Founding Developer", "Founding Developer"],
    );
    await expect
      .poll(() =>
        page
          .locator("#team img")
          .evaluate((el) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: join(output, `team-${width}-${reducedMotion}.png`),
    });
    await nav.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page).toHaveURL(/#overview$/);
    await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(0);
    if (reducedMotion === "no-preference") {
      await expect(page.locator(".cinematic-stage")).not.toHaveAttribute(
        "inert",
        "",
      );
    }
    await page.goBack();
    await expect(page).toHaveURL(/#team$/);
    await expect
      .poll(() =>
        page
          .locator("#team")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(width <= 600 ? 64 : 72);
    await page.reload({ waitUntil: "networkidle" });
    await expect
      .poll(() =>
        page
          .locator("#team")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(width <= 600 ? 64 : 72);
    await expect(nav).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px / ${reducedMotion}: navigation, roster, photo, anchors, Back, direct link, overflow`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
