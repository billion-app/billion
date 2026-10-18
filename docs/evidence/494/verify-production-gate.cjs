/** Run against `expo start --web --no-dev --port 8095`; requires Playwright. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  try {
    const base = process.env.BILLION_PREVIEW_URL ?? "http://localhost:8095";
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    let lookups = 0;
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/trpc/")) {
        const names = url.pathname.split("/trpc/")[1].split(",");
        lookups += names.filter((name) => name === "civic.getVoterInfo").length;
        return route.fulfill({
          json: names.map((name) => ({
            result: {
              data: {
                json:
                  name === "civic.getBallotAvailability"
                    ? { lookupEnabled: false }
                    : null,
              },
            },
          })),
        });
      }
      return url.origin === new URL(base).origin
        ? route.continue()
        : route.abort();
    });
    await context.addInitScript(() => {
      localStorage.setItem(
        "billion.onboarding.v1",
        JSON.stringify({
          completed: true,
          vectors: ["state"],
          sectors: ["technology", "healthcare", "energy"],
          topics: [],
          alerts: { instant: false, digest: false },
          deferredClaim: true,
        }),
      );
      localStorage.setItem("user_address", "123 Oak St, Sacramento, CA 95814");
      localStorage.setItem("billion.language.v1", "en");
    });
    const page = await context.newPage();
    await page.goto(`${base}/how-to-vote`);
    await page
      .getByText("Ballot lookup unavailable", { exact: true })
      .waitFor({ timeout: 120000 });
    assert.equal(
      lookups,
      0,
      "Closed availability must not issue a personalized lookup",
    );
    await page.screenshot({
      path: path.join(__dirname, "how-to-vote-gated-production-390.png"),
    });
    console.log(
      "PASS: production direct link with a saved address issues zero personalized lookups while gated",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
