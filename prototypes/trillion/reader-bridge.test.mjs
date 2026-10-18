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
          return <><span id="native-back-state">{String(inside)}</span><TrillionReader
            graph={JSON.parse(JSON.stringify(graph))} localState="" onLocalState={async () => {}}
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
    await page.locator(".pinned-dispute").click();
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
    await page.locator("[data-close]").first().click();
    assert.match(
      await page.locator("#page h1").textContent(),
      /Would audits improve public services/,
    );
    await page.locator("#back").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#native-back-state").textContent === "false",
    );
    assert.match(
      await page.locator("#page h1").textContent(),
      /How should I vote/,
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
