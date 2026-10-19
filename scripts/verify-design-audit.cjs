// Run against Expo web with no real API writes: node scripts/verify-design-audit.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const base = process.env.DESIGN_AUDIT_URL || "http://127.0.0.1:8097";
const out =
  process.env.DESIGN_AUDIT_EVIDENCE || "/tmp/billion-design-audit-fixes";
const originalGraph = require("../apps/expo/src/components/trillion/development/prop40-pilot.json");
const translatedGraph = JSON.parse(JSON.stringify(originalGraph));
translatedGraph.nodes.find((n) => n.id === translatedGraph.rootId).title =
  "这项提案会带来什么变化？";
const article = {
  id: "design-audit-bill",
  type: "bill",
  title: "Fictional school funding bill",
  billNumber: "DEMO 1",
  jurisdiction: "federal",
  url: "https://www.congress.gov/",
  isAIGenerated: true,
  originalContent: "Synthetic source text.",
  articleContent: "Synthetic English article body.",
  description: "Synthetic description.",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  translationSourceHash: "a".repeat(64),
  translation: null,
  brief: null,
  imageUri: null,
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(() => {
        localStorage.setItem("billion.language.v1", "zh");
        localStorage.setItem(
          "billion.onboarding.v1",
          JSON.stringify({
            completed: true,
            vectors: [],
            sectors: [],
            topics: [],
            alerts: { instant: false, digest: false },
            deferredClaim: true,
          }),
        );
      });
      let state = "pending";
      let measureRequests = 0;
      await context.route("**/api/trpc/**", async (route) => {
        const procedures = new URL(route.request().url()).pathname
          .split("/api/trpc/")[1]
          .split(",");
        const input = JSON.parse(
          new URL(route.request().url()).searchParams.get("input") ||
            route.request().postData() ||
            "{}",
        );
        const data = procedures.map((name, index) => {
          const requestedLanguage = input[index]?.json?.language ?? "zh";
          if (name === "civic.getMeasureTranslation") measureRequests++;
          if (
            state === "error" &&
            ["content.getTranslation", "civic.getMeasureTranslation"].includes(
              name,
            )
          )
            return {
              error: {
                json: {
                  message: "Synthetic offline failure",
                  code: -32603,
                  data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
                },
              },
            };
          let value = null;
          if (name === "civic.getMeasureTranslation")
            value =
              state === "ready"
                ? {
                    status: "translated",
                    language: requestedLanguage,
                    sourceHash: `fixture-${requestedLanguage}`,
                    graph: translatedGraph,
                    measure: {},
                  }
                : { status: "pending" };
          if (name === "content.getById") value = article;
          if (name === "content.getTranslation")
            value = { status: "unavailable" };
          return { result: { data: { json: value } } };
        });
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      });
      await context.route("https://fonts.googleapis.com/**", (route) =>
        route.abort(),
      );
      const page = await context.newPage();
      await page.clock.install();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/trillion-preview?number=40`);
      await page
        .getByTestId("translation-pending")
        .waitFor({ timeout: 90_000 });
      assert.equal(
        await page.locator("#page").count(),
        0,
        "English debate must not mount while Chinese translation is pending",
      );
      const back = page.getByRole("button", { name: "返回", exact: true });
      assert.ok(
        (await back.boundingBox()).y < 100,
        "Back remains near the top",
      );
      assert.match(
        await page.getByTestId("reader-show-english").textContent(),
        /整个应用/,
      );
      await page.screenshot({
        path: `${out}/measure-pending-${width}.png`,
        fullPage: true,
      });
      await page.clock.fastForward(120_001);
      await page.getByTestId("translation-delayed").waitFor();
      await page.screenshot({
        path: `${out}/measure-delayed-${width}.png`,
        fullPage: true,
      });
      const requestsAtPause = measureRequests;
      await page.clock.fastForward(9_000);
      assert.equal(
        measureRequests,
        requestsAtPause,
        "automatic translation checks stop after a long wait",
      );
      await page.getByTestId("translation-retry").click();
      await page.getByTestId("translation-pending").waitFor();
      state = "error";
      await page.reload();
      await page
        .getByTestId("translation-unavailable")
        .waitFor({ timeout: 35_000 });
      await page.screenshot({
        path: `${out}/measure-error-${width}.png`,
        fullPage: true,
      });
      state = "ready";
      await page.getByTestId("translation-retry").click();
      await page
        .getByRole("heading", { name: "这项提案会带来什么变化？", exact: true })
        .waitFor({ timeout: 30_000 });
      assert.equal(
        await page.locator("#back").isVisible(),
        false,
        "DOM header does not duplicate the native header",
      );
      assert.equal((await page.locator('[lang="zh-Hans"]').count()) > 0, true);
      await page.clock.runFor(500);
      await page.screenshot({
        path: `${out}/measure-ready-${width}.png`,
        fullPage: true,
      });
      await page.clock.fastForward(120_001);
      state = "pending";
      const beforeFocus = measureRequests;
      await page.bringToFront();
      // Let a final ready response settle before advancing past staleTime.
      for (
        let focus = 0;
        focus < 3 && measureRequests === beforeFocus;
        focus++
      ) {
        await page.clock.runFor(100);
        await page.clock.fastForward(31_001);
        await page.evaluate(() =>
          window.dispatchEvent(new Event("visibilitychange")),
        );
        await page.waitForTimeout(100);
      }
      assert.ok(
        measureRequests > beforeFocus,
        "ready translations still refresh on later focus",
      );
      await page.getByTestId("translation-pending").waitFor();
      state = "ready";
      await page.clock.fastForward(3_100);
      await page
        .getByRole("heading", { name: "这项提案会带来什么变化？", exact: true })
        .waitFor();
      await page.locator('[data-tab="disagree"]').first().click();
      const question = page.locator(".dispute-row .go").first();
      const questionId = await question.getAttribute("data-node");
      await question.click();
      const questionTitle = originalGraph.nodes.find(
        (node) => node.id === questionId,
      ).title;
      await page.getByTestId("reader-show-english").click();
      await page
        .getByTestId("translation-translated")
        .waitFor({ state: "detached" });
      assert.equal(
        await page.evaluate(() => localStorage.getItem("billion.language.v1")),
        "en",
      );
      await page.locator('.trillion-root[lang="en"]').waitFor();
      await page.waitForFunction(
        (title) => document.querySelector("#page h1")?.textContent === title,
        questionTitle,
      );
      assert.equal(
        await page.locator("#page h1").textContent(),
        questionTitle,
        "language changes preserve the current debate question",
      );
      const readingViewport = await page
        .locator(".trillion-root")
        .boundingBox();
      assert.ok(
        readingViewport.y + readingViewport.height <= 845,
        "reader fits the space below native navigation",
      );

      const languageButton = await page
        .getByTestId("reader-language")
        .first()
        .boundingBox();
      assert.ok(
        languageButton.x >= 0 &&
          languageButton.x + languageButton.width <= width,
      );
      await page.clock.runFor(500);
      await page.screenshot({
        path: `${out}/measure-en-${width}.png`,
        fullPage: true,
      });

      state = "pending";
      await page.getByTestId("reader-language").first().click();
      await page.getByTestId("reader-language-es").click();
      await page.getByTestId("translation-pending").waitFor();
      assert.equal(
        await page.locator(".trillion-root").isVisible(),
        false,
        "the previous language stays hidden while the next translation prepares",
      );
      assert.equal(
        (await page.locator("body").innerText()).includes(questionTitle),
        false,
      );
      state = "ready";
      await page.clock.fastForward(3_100);
      await page
        .getByRole("heading", { name: questionTitle, exact: true })
        .waitFor();
      assert.equal(
        await page.locator(".trillion-root").getAttribute("lang"),
        "es",
      );
      await page.clock.runFor(500);
      await page.screenshot({
        path: `${out}/measure-es-preserved-${width}.png`,
        fullPage: true,
      });
      await page.evaluate(() =>
        localStorage.setItem("billion.language.v1", "zh"),
      );
      state = "pending";
      await page.goto(`${base}/article-detail?id=${article.id}`);
      await page
        .getByTestId("translation-pending")
        .waitFor({ timeout: 30_000 });
      assert.match(await page.locator("body").innerText(), /DEMO 1/);
      assert.equal(
        await page.getByText(article.articleContent, { exact: true }).count(),
        0,
      );
      await page.screenshot({
        path: `${out}/article-pending-${width}.png`,
        fullPage: true,
      });
      await page.goto(`${base}/design-audit-preview`);
      await page.getByTestId("ota-update-card").waitFor();
      await page.getByTestId("ota-restart").click();
      assert.equal(await page.getByTestId("ota-dismiss").isEnabled(), true);
      await page.getByTestId("underlying-action").click();
      assert.match(
        await page.getByTestId("underlying-action").textContent(),
        /1$/,
      );
      await page.screenshot({
        path: `${out}/ota-busy-${width}.png`,
        fullPage: true,
      });
      await page.getByTestId("ota-dismiss").click();
      await page.getByTestId("preview-dismissed").waitFor();
      await page.goto(`${base}/design-audit-preview?kind=store`);
      await page.getByTestId("store-update-card").waitFor();
      assert.match(
        await page.getByTestId("store-update-card").innerText(),
        /有新版本可用/,
      );
      await page.screenshot({
        path: `${out}/store-zh-${width}.png`,
        fullPage: true,
      });
      for (const [language, title] of [
        ["es", "Hay una actualización"],
        ["en", "An update is here"],
      ]) {
        await page.getByTestId("reader-language").first().click();
        await page.getByTestId(`reader-language-${language}`).click();
        assert.match(
          await page.getByTestId("store-update-card").innerText(),
          new RegExp(title),
        );
        await page.screenshot({
          path: `${out}/store-${language}-${width}.png`,
          fullPage: true,
        });
      }
      await page.getByTestId("store-dismiss").click();
      await page.getByTestId("preview-dismissed").waitFor();
      assert.deepEqual(errors, [], "no browser exceptions");
      await context.close();
      console.log(
        `Verified ${width}px: translated waiting/error/retry, correct content language, top Back, article identity, explicit language action, dismissible busy OTA, localized App Store card.`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
