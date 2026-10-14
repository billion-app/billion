const { webkit } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
(async () => {
  const dir = path.resolve(process.argv[2], "www.bundle");
  const server = http.createServer((req, res) => {
    const f = path.join(
      dir,
      req.url === "/"
        ? fs.readdirSync(dir).find((x) => x.endsWith(".html"))
        : req.url,
    );
    res.setHeader(
      "Content-Type",
      f.endsWith(".js")
        ? "application/javascript"
        : f.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await webkit.launch();
  try {
    for (const width of [390, 440]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
      await page.addInitScript(
        (graph) => {
          window.ReactNativeWebView = {
            injectedObjectJson: () =>
              JSON.stringify({
                EXPO_DOM_HOST_OS: "ios",
                initialProps: { props: { graph }, names: [] },
              }),
            postMessage: () => {},
          };
        },
        JSON.parse(
          fs.readFileSync("evidence/trillion-map-sizing/prop37.json", "utf8"),
        ),
      );
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.locator('[data-node="what"]').first().click();
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-view="map"]').click();
        await page.waitForTimeout(300);
        const reader = await page
          .locator("#reader")
          .evaluate((x) => x.getBoundingClientRect().width);
        console.log({ width, transition: i + 1, reader });
        await page.screenshot({
          path: `evidence/trillion-map-sizing/export-${width}.png`,
        });
        assert.equal(
          reader,
          width,
          "List → Map must retain the full reader width",
        );
        await page.locator('[data-view="list"]').click();
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
