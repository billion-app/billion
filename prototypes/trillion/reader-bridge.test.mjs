// The native bridge serializes graph props again when its back state changes.
// Mount the real DOM adapter and reproduce that parent render in a browser.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";

const require = createRequire(resolve("apps/expo/package.json"));
const { build } = require(
  require.resolve("esbuild", {
    paths: [resolve("node_modules/.pnpm/node_modules")],
  }),
);

await test("native back-state renders preserve the reader path and open sheets", async () => {
  const result = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import TrillionReader from './src/components/trillion/dom/TrillionReader';
        import graph from './src/components/trillion/development/prop41-generated.json';
        function NativeHost() {
          const [inside, setInside] = useState(false);
          const [language, setLanguage] = useState("en");
          const [translated, setTranslated] = useState(false);
          const displayGraph = JSON.parse(JSON.stringify(graph));
          if (translated) displayGraph.terms[0] = {term: "auditorías", plain: "Revisiones de las finanzas de un programa."};
          return <><button id="translation-ready" onClick={() => setTranslated(true)}>Translation ready</button><button id="language-zh" onClick={() => setLanguage("zh")}>中文</button><button id="language-es" onClick={() => setLanguage("es")}>Español</button><span id="native-back-state">{String(inside)}</span><TrillionReader
            language={language} translationKey={translated ? "es:translated" : "en"} graph={displayGraph} localState="" onLocalState={async () => {}}
            onExit={async () => {}} onOpenUrl={async () => {}} onOpenMeasure={async () => {}}
            onBackState={async (value) => setInside(value)} /></>;
        }
        createRoot(document.getElementById('root')).render(<NativeHost />);
      `,
      resolveDir: resolve("apps/expo"),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "bridge.js",
    jsx: "automatic",
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "native-imperative-handle",
        setup(builder) {
          builder.onResolve({ filter: /^expo\/dom$/ }, () => ({
            path: "expo-dom-handle",
            namespace: "bridge-test",
          }));
          builder.onLoad({ filter: /.*/, namespace: "bridge-test" }, () => ({
            contents: `export { useImperativeHandle as useDOMImperativeHandle } from 'react';`,
            resolveDir: resolve("apps/expo"),
          }));
        },
      },
    ],
  });
  const server = createServer((req, res) => {
    if (req.url === "/bridge.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(result.outputFiles[0].text);
    } else res.end('<div id="root"></div><script src="/bridge.js"></script>');
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.abort(),
    );
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-tab="disagree"]').first().click();
    await page.locator(".dispute-row .go").first().click();
    // Let React effects run after the parent sends its newly serialized props.
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    assert.equal(
      await page.locator("#native-back-state").textContent(),
      "true",
      "the native back-state update must not reset the reader",
    );
    assert.match(
      await page.locator("#page h1").textContent(),
      /Would audits improve public services/,
    );
    assert.equal(
      await page.locator('#crumbs [aria-current="page"]').count(),
      1,
    );
    await page.locator("[data-flag]").click();
    assert.equal(
      await page.locator("#sheet-title").textContent(),
      "Flag an argument fault",
    );
    await page.locator("#language-zh").click();
    await page.locator("#sheet-title").waitFor();
    assert.equal(
      await page.locator("#sheet-title").textContent(),
      "标记论证问题",
      "labels must change while content translation is pending",
    );
    assert.equal(
      await page.locator('[data-fault="False choice"] .fc-name').textContent(),
      "虚假两难",
      "flag labels translate without changing persisted keys",
    );
    await page.locator('[data-fault="False choice"]').click();
    assert.match(await page.locator("[data-flag]").textContent(), /虚假两难/);
    assert.match(
      await page.locator("#page h1").textContent(),
      /Would audits improve public services/,
      "language changes retain the focused claim",
    );
    assert.equal(await page.locator('#root [lang="zh-Hans"]').count(), 1);
    assert.match(await page.locator("#crumbs").textContent(), /主要议题/);
    await page.locator("#back").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#native-back-state").textContent === "false",
    );
    assert.match(
      await page.locator("#page h1").textContent(),
      /How should I vote/,
    );
    await page.locator(".summary-more summary").first().click();
    // Give the real reader a constrained viewport to exercise scroll restoration.
    await page.addStyleTag({
      content: "#reader {height: 250px; overflow: auto;}",
    });
    await page.locator("#reader").evaluate((element) => {
      element.scrollTop = 100;
    });
    const scroll = await page
      .locator("#reader")
      .evaluate((element) => element.scrollTop);
    assert.ok(scroll > 0);
    await page.locator("#language-es").click();
    assert.equal(
      await page.locator(".summary-more").first().getAttribute("open"),
      "",
    );
    assert.equal(
      await page.locator("#reader").evaluate((element) => element.scrollTop),
      scroll,
    );
    assert.match(
      await page.locator(".summary-more summary").first().textContent(),
      /Leer más/,
    );
    await page.locator('[data-term="audits"]').first().click();
    assert.equal(await page.locator("#sheet-title").textContent(), "audits");
    await page.locator("#translation-ready").click();
    assert.equal(
      await page.locator("#sheet-title").textContent(),
      "auditorías",
    );
    assert.match(
      await page.locator("#layer .body").textContent(),
      /Revisiones/,
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
