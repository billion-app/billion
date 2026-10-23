// The real address component and hook, with only OS/location and analytics boundaries replaced.
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const fs = require("node:fs");
const { chromium } = require("@playwright/test");
const app = resolve("apps/expo");
const req = createRequire(resolve(app, "package.json"));
const { build } = req(
  req.resolve("esbuild", {
    paths: [resolve("node_modules/.pnpm/node_modules")],
  }),
);
(async () => {
  const bundle = await build({
    stdin: {
      contents: `
   import React, { useState } from 'react';
   import { createRoot } from 'react-dom/client';
   import { AddressAutocomplete } from './src/components/AddressAutocomplete';
   import { AddressForm } from './src/components/AddressForm';
   window.saved = [];
   function Host() {
    const [cancelled, setCancelled] = useState(false);
    return <div style={{width:320,background:'#0E1530',padding:16}}>{cancelled ? <p id="cancelled">Cancelled</p> : <AddressAutocomplete inline onSubmit={address => window.saved.push(address)} onCancel={() => setCancelled(true)} />}</div>;
   }
   createRoot(document.getElementById('root')).render(window.location.search === '?manual' ? <AddressForm inline onSubmit={address => window.saved.push(address)} /> : <Host />);`,
      loader: "tsx",
      resolveDir: app,
    },
    bundle: true,
    write: false,
    outfile: "/tmp/address-draft.js",
    jsx: "automatic",
    platform: "browser",
    alias: { "react-native": req.resolve("react-native-web") },
    resolveExtensions: [
      ".web.tsx",
      ".tsx",
      ".web.ts",
      ".ts",
      ".web.js",
      ".js",
      ".json",
    ],
    define: { __DEV__: "false", "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "device-boundaries",
        setup(builder) {
          builder.onResolve(
            {
              filter:
                /^(expo-location|expo-localization|@react-native-async-storage\/async-storage|~\/config\/posthog)$/,
            },
            (args) => ({ path: args.path, namespace: "device" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "device" }, (args) => ({
            contents:
              args.path === "expo-location"
                ? `export const Accuracy={Balanced:3}; export const hasServicesEnabledAsync=async()=>true; export const requestForegroundPermissionsAsync=async()=>({granted:true}); export const getCurrentPositionAsync=()=>new Promise(r=>window.finishFix=()=>r({coords:{latitude:38.5,longitude:-121.5}})); export const reverseGeocodeAsync=async()=>[{streetNumber:'123',street:'Main Street',city:'Sacramento',region:'CA',postalCode:'95814',country:'United States'}];`
                : args.path === "expo-localization"
                  ? `export const getLocales=()=>[{languageTag:'en-US'}];`
                  : args.path === "~/config/posthog"
                    ? `export const posthog={capture(){}};`
                    : `export default {getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v)};`,
            resolveDir: app,
          }));
        },
      },
    ],
  });
  const server = createServer((request, response) => {
    if (request.url === "/app.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else response.end('<div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 360, height: 640 },
    });
    if (!process.argv.includes("--manual-only")) {
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page
        .getByRole("button", { name: "Use my location", exact: true })
        .click();
      await page.getByText("Finding your location…", { exact: true }).waitFor();
      await page.evaluate(() => window.finishFix());
      const field = page.getByRole("textbox");
      await field.filter({ visible: true }).waitFor();
      await page.waitForFunction(() =>
        document.querySelector("input")?.value.includes("123 Main Street"),
      );
      assert.deepEqual(
        await page.evaluate(() => window.saved),
        [],
        "GPS fills a draft; it must not save automatically",
      );
      assert.match(
        await page.locator("body").innerText(),
        /Check it, then tap Save/,
      );
      fs.mkdirSync("/tmp/billion-address-audit-fixes", { recursive: true });
      await page.screenshot({
        path: "/tmp/billion-address-audit-fixes/filled-device-draft.png",
      });
      await page.getByRole("button", { name: "Save", exact: true }).click();
      assert.equal((await page.evaluate(() => window.saved)).length, 1);
      await page.reload();
      await page
        .getByRole("button", { name: "Use my location", exact: true })
        .click();
      await page.getByText("Finding your location…", { exact: true }).waitFor();
      await page.getByRole("textbox").fill("A manually chosen address");
      await page.evaluate(() => window.finishFix());
      assert.equal(
        await page.getByRole("textbox").inputValue(),
        "A manually chosen address",
        "late GPS must not replace typing",
      );
      assert.deepEqual(await page.evaluate(() => window.saved), []);
      await page.reload();
      await page
        .getByRole("button", { name: "Use my location", exact: true })
        .click();
      await page.getByText("Finding your location…", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.evaluate(() => window.finishFix());
      await page.locator("#cancelled").waitFor();
      assert.deepEqual(
        await page.evaluate(() => window.saved),
        [],
        "cancelled GPS must not commit",
      );
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/?manual`);
    assert.equal(
      await page
        .getByRole("button", { name: "Use my location", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save", exact: true })
        .isDisabled(),
      true,
    );
    await page
      .getByRole("textbox")
      .fill("  200 E Santa Clara St, San Jose, CA 95113  ");
    assert.deepEqual(await page.evaluate(() => window.saved), []);
    await page.getByRole("textbox").press("Enter");
    assert.deepEqual(await page.evaluate(() => window.saved), [
      "200 E Santa Clara St, San Jose, CA 95113",
    ]);
    await page.screenshot({
      path: "/tmp/billion-address-audit-fixes/manual-address.png",
    });
    console.log(
      process.argv.includes("--manual-only")
        ? "Verified manual address entry without location: blank Save disabled, typing requires confirmation, submitted address trimmed."
        : "Verified manual and device address entry: GPS fills a draft, Save confirms, typing wins over late GPS, Cancel prevents commit. OS provider is simulated.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
