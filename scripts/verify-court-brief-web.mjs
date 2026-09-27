import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";

// Serve actual results from the local DB regression over fixture tRPC transport.
// No database credentials, writes, provider calls, or live app API are involved.
const directory = process.env.COURT_BRIEF_TEST_ARTIFACT_DIR;
assert.ok(
  directory,
  "Set COURT_BRIEF_TEST_ARTIFACT_DIR to the DB test artifacts",
);
const screenshotDirectory = process.env.COURT_BRIEF_SCREENSHOT_DIR ?? directory;
mkdirSync(screenshotDirectory, { recursive: true });
const webUrl = process.env.COURT_BRIEF_TEST_WEB_URL ?? "http://127.0.0.1:8091";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(webUrl).hostname));
const details = Object.fromEntries(
  ["valid", "missing", "stale", "invalid"].map((name) => [
    name,
    JSON.parse(readFileSync(join(directory, `${name}.json`), "utf8")),
  ]),
);
const server = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", new URL(webUrl).origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "content-type,trpc-accept,x-trpc-source",
  );
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") return response.end();
  const url = new URL(request.url, "http://127.0.0.1:4013");
  if (!url.pathname.startsWith("/api/trpc/")) return response.end("null");
  const input = JSON.parse(url.searchParams.get("input") ?? "{}");
  const procedures = url.pathname.split("/api/trpc/")[1].split(",");
  const results = procedures.map((procedure, i) => ({
    result: {
      data: {
        json:
          procedure === "content.getById" ? details[input[i]?.json?.id] : [],
      },
    },
  }));
  response.end(JSON.stringify(results));
});
await new Promise((resolve) => server.listen(4013, "127.0.0.1", resolve));
const execute = promisify(execFile);
const session = `court-brief-${process.pid}`;
async function browser(...args) {
  const { stdout } = await execute(
    "pnpm",
    ["dlx", "agent-browser", "--session", session, ...args],
    { timeout: 60_000, maxBuffer: 2_000_000 },
  );
  return stdout;
}
async function scrollToText(text) {
  await browser(
    "eval",
    `(() => {
      const target = [...document.querySelectorAll('[dir="auto"]')]
        .find((node) => node.textContent?.trim() === ${JSON.stringify(text)});
      if (!target) throw new Error(${JSON.stringify(`Missing text: ${text}`)});
      target.scrollIntoView({ block: "start" });
      window.scrollBy(0, -72);
    })()`,
  );
  await browser("wait", "250");
}
try {
  await browser("set", "viewport", "390", "844");
  await browser("open", `${webUrl}/article-detail?id=valid`);
  await browser(
    "eval",
    'localStorage.setItem("billion.onboarding.v1", JSON.stringify({completed:true}))',
  );
  for (const name of ["valid", "missing", "stale", "invalid"]) {
    await browser("open", `${webUrl}/article-detail?id=${name}`);
    await browser("wait", '[data-testid="article-content"]');
    const text = await browser("get", "text", "body");
    assert.doesNotMatch(text, /Committee review|Becomes law/);
    if (name === "valid") {
      assert.match(text, /Emergency order/);
      assert.match(text, /Temporary decision/);
      assert.match(text, /What the court did/);
      assert.match(text, /How the court got there/);
      assert.match(text, /Who it lands on/);
      assert.match(text, /What the ruling doesn.t settle/);
      await browser(
        "screenshot",
        join(screenshotDirectory, "court-brief-overview.png"),
      );
      await scrollToText("What the court did");
      await browser(
        "screenshot",
        join(screenshotDirectory, "court-brief-ruling.png"),
      );
      await browser(
        "eval",
        `(() => {
          const terms = [...document.querySelectorAll('[aria-label="Define stay"]')];
          const target = terms.at(-1);
          if (!target) throw new Error("Missing inline definition for stay");
          target.click();
        })()`,
      );
      await browser("wait", '[data-testid="court-term-definition"]');
      assert.match(await browser("get", "text", "body"), /temporary pause/i);
      await browser(
        "eval",
        `(() => {
          const target = document.querySelector('[data-testid="court-term-definition"]');
          target.scrollIntoView({ block: "center" });
        })()`,
      );
      await browser(
        "screenshot",
        join(screenshotDirectory, "court-brief-definition.png"),
      );
      await browser(
        "eval",
        `document.querySelector('[aria-label="Define stay"][aria-expanded="true"]')?.click()`,
      );
      await browser(
        "find",
        "role",
        "button",
        "click",
        "--name",
        "Show the source text",
      );
      await scrollToText("What the court did");
      await browser(
        "screenshot",
        join(screenshotDirectory, "court-brief-source-quote.png"),
      );
      const snapshot = await browser("snapshot", "-i");
      assert.match(snapshot, /Open full official document document-1/);
      await browser(
        "eval",
        "window.__courtOpenedSources=[];window.__courtOriginalOpen=window.open;window.open=(url)=>{window.__courtOpenedSources.push(url);return null}",
      );
      await browser(
        "find",
        "role",
        "link",
        "click",
        "--name",
        "Open full official document document-1",
      );
      assert.ok(
        (
          await browser("eval", "JSON.stringify(window.__courtOpenedSources)")
        ).includes(details.valid.courtBrief.sources[0].url),
      );
      await browser("eval", "window.open=window.__courtOriginalOpen");
      await browser("find", "text", "Opinions", "click");
      await browser("wait", '[data-testid="court-opinions"]');
      const opinionsText = await browser("get", "text", "body");
      assert.match(opinionsText, /Read the opinions/);
      assert.match(opinionsText, /CONCURRENCE/);
      assert.match(opinionsText, /DISSENT/);
      await browser(
        "screenshot",
        join(screenshotDirectory, "court-brief-details.png"),
      );
    } else {
      assert.doesNotMatch(text, /The short version/);
      assert.match(
        text,
        name === "missing"
          ? /Legacy Markdown explanation/
          : /application for stay/,
      );
    }
    console.log(`Expo court article route: ${name} passed`);
  }
  await browser("open", `${webUrl}/article-detail?id=valid`);
  await browser("wait", '[data-testid="article-content"]');
  await browser("find", "text", "Court record", "click");
  await browser("wait", '[data-testid="article-content"]');
  assert.match(await browser("get", "text", "body"), /application for stay/);
  await browser(
    "screenshot",
    join(screenshotDirectory, "court-brief-original-text.png"),
  );
  console.log("Original court source text passed");
} finally {
  await browser("close");
  server.close();
}
