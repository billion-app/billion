import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import { chromium } from "@playwright/test";

// A deliberately edited preview of existing, quote-verified evidence, not a model run.
const graph = JSON.parse(
  await readFile("docs/evidence/455/prop40-graph.json", "utf8"),
);
graph.nodes.push({
  id: "b-before",
  kind: "branch",
  label: "What was it like before?",
  title: "What was it like before?",
  body: "Existing rules, past results and money in context. Each record keeps its date, scope and limits.",
  quotes: [],
});
graph.edges.push({
  id: "part-before",
  from: "b-before",
  to: "root",
  type: "part",
});
const history = graph.nodes.find((n) => n.id === "p-unspent");
history.context = {
  topic: "history",
  period: "2015–16; audit published 2018",
  scope: "California MHSA local balances",
  limitation:
    "This historical balance does not establish current recoverable savings or predict how a wealth tax would perform.",
  money: [
    {
      nominal: "$231 million",
      currency: "USD",
      scope: {
        period: "End of fiscal year 2015–16",
        jurisdiction: "California",
        timing: "stock",
        accounting: "unspecified",
      },
      comparison: {
        state: "unavailable",
        reason: "No matching total fund balance is established by this source.",
      },
    },
  ],
};
graph.edges.push({
  id: "detail-before-history",
  from: history.id,
  to: "b-before",
  type: "detail",
});
graph.nodes.find((n) => n.id === "x-history").highlight = {
  rank: 1,
  reason:
    "Past delivery helps readers assess whether another earmarked funding program would achieve its aims.",
  evidence: [history.id],
};
graph.nodes.find((n) => n.id === "x-revenue").highlight = {
  rank: 2,
  reason:
    "The amount available for services depends on how taxpayers respond to the proposal.",
  evidence: ["l-revenue"],
};
for (const [topic, title] of [
  ["baseline", "How do the existing rules and programs work?"],
  ["budget", "Where does the existing money go?"],
]) {
  const id = `context-gap-${topic}`;
  graph.nodes.push({
    id,
    kind: "question",
    label: title,
    title,
    body: "The captured sources do not yet establish an answer. This does not mean no evidence exists.",
    quotes: [],
  });
  graph.edges.push({
    id: `detail-${id}`,
    from: id,
    to: "b-before",
    type: "detail",
  });
}

await test("decision context, selection reasons and sources work on narrow and wide readers", async () => {
  const bundle = await readFile("prototypes/trillion/reader.bundle.js");
  const css = await readFile(
    "apps/expo/src/components/trillion/dom/reader.css",
  );
  const server = createServer((req, res) => {
    if (req.url === "/reader.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(bundle);
    } else if (req.url === "/reader.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/reader.css"><div id="root" class="trillion-root"></div><script src="/reader.js"></script>',
      );
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  await mkdir("/tmp/billion-decision-context", { recursive: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        hasTouch: width < 500,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate((value) => {
        window.reader = TrillionReader.mountTrillionReader(
          document.getElementById("root"),
          value,
        );
      }, graph);
      assert.equal(
        await page.locator(".selection-reason").count(),
        0,
        "Basics should not repeat the selected disputes above its grid",
      );
      await page.locator('[data-tab="disagree"]').first().click();
      assert.deepEqual(
        await page
          .locator(".dispute-row .go")
          .evaluateAll((cards) =>
            cards.slice(0, 2).map((card) => card.dataset.node),
          ),
        ["x-history", "x-revenue"],
        "editorial selections lead the dispute list in rank order",
      );
      assert.equal(
        await page.locator(".dispute-row.is-highlighted").count(),
        2,
      );
      assert.equal(
        await page.locator('.dispute-row .go[data-node="x-history"]').count(),
        1,
      );
      const reason = page.locator(".dispute-row .selection-reason").first();
      assert.equal(await reason.getAttribute("open"), null);
      await reason.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.notEqual(await reason.getAttribute("open"), null);
      assert.match(await reason.textContent(), /Selected by Billion AI/);
      assert.equal(
        await page.locator("#page h1").textContent(),
        graph.nodes.find((n) => n.id === "root").title,
      );
      await page.keyboard.press("Enter");
      assert.equal(await reason.getAttribute("open"), null);
      await page.locator(".dispute-row").first().scrollIntoViewIfNeeded();
      await page
        .locator("#page")
        .evaluate((el) =>
          Promise.all(
            el
              .getAnimations({ subtree: true })
              .map((animation) => animation.finished.catch(() => {})),
          ),
        );
      await page.screenshot({
        path: `/tmp/billion-decision-context/highlights-${width}.png`,
      });
      await reason.locator("summary").evaluate((el) => el.blur());
      await page
        .locator('[role="tablist"]')
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: `/tmp/billion-decision-context/disputes-comparison-${width}.png`,
      });
      await reason.locator("summary").click();
      await page.locator('.selection-evidence [data-node="p-unspent"]').click();
      assert.match(
        await page.locator(".decision-context").textContent(),
        /Budget share unavailable/,
      );
      assert.match(
        await page.locator(".decision-context").textContent(),
        /2015–16/,
      );
      assert.match(
        await page.locator(".context-limit").textContent(),
        /does not establish current recoverable savings/,
      );
      await page.locator("[data-source]").click();
      assert.match(
        await page.locator(".sheet").textContent(),
        /Report 2017-117/,
      );
      assert.match(
        await page.locator(".sheet a").first().getAttribute("href"),
        /2017-117.pdf/,
      );
      await page.locator("[data-close]").first().click();
      await page.locator("#reader").evaluate((el) => {
        el.scrollTop = 0;
      });
      await page
        .locator("#page")
        .evaluate((el) =>
          Promise.all(
            el
              .getAnimations({ subtree: true })
              .map((animation) => animation.finished.catch(() => {})),
          ),
        );
      await page.screenshot({
        path: `/tmp/billion-decision-context/history-${width}.png`,
      });
      await page.locator("#back").click();
      await page.locator('.tile[data-node="b-before"]').click();
      assert.deepEqual(
        await page.locator(".context-group h2").allTextContents(),
        ["Existing rules", "Past results", "Money in context"],
      );
      assert.match(
        await page.locator(".context-group").nth(2).textContent(),
        /Where does the existing money go/,
      );
      await page.locator("#reader").evaluate((el) => {
        el.scrollTop = 0;
      });
      await page
        .locator("#page")
        .evaluate((el) =>
          Promise.all(
            el
              .getAnimations({ subtree: true })
              .map((animation) => animation.finished.catch(() => {})),
          ),
        );
      await page.screenshot({
        path: `/tmp/billion-decision-context/before-${width}.png`,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "reader must not overflow horizontally",
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});
