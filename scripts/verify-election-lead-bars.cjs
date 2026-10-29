const { chromium } = require(process.cwd() + "/node_modules/@playwright/test");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const output =
  process.env.RESULTS_EVIDENCE_DIR || "/tmp/billion-election-lead-bars";
(async () => {
  const guideResponse = fs.existsSync(`${output}/guide-response.json`)
    ? JSON.parse(fs.readFileSync(`${output}/guide-response.json`, "utf8"))
    : await (
        await fetch(
          "https://www.billion-news.app/api/trpc/civic.getCaliforniaGuide?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D",
        )
      ).json();
  const guide = guideResponse[0].result.data.json;
  assert.ok(
    guide?.candidates?.length && guide?.measures?.length,
    "The official guide is available",
  );
  const source = {
    totalVotes: 100,
    reportedAt: "2026-11-04T04:01:00Z",
    reportingLabel: "UI fixture",
    sourceUrl: "https://electionresults.sos.ca.gov/",
  };
  const officeIndices = new Map();
  const candidates = Object.fromEntries(
    guide.candidates.map((candidate) => {
      const index = officeIndices.get(candidate.officeSlug) || 0;
      officeIndices.set(candidate.officeSlug, index + 1);
      return [
        `${candidate.officeSlug}:${candidate.name}`,
        {
          ...source,
          votes: index === 0 ? 60 : 40,
          share: index === 0 ? 60 : 40,
          standing: index === 0 ? "leading" : "trailing",
          rank: index + 1,
          fieldSize: 2,
        },
      ];
    }),
  );
  const measures = Object.fromEntries(
    guide.measures.map((measure, index) => [
      measure.number,
      {
        ...source,
        yes: {
          votes: index ? 50 : 60,
          share: index ? 50 : 60,
          standing: index ? "tied" : "leading",
        },
        no: {
          votes: index ? 50 : 40,
          share: index ? 50 : 40,
          standing: index ? "tied" : "trailing",
        },
      },
    ]),
  );
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "billion.onboarding.v1",
        JSON.stringify({
          completed: true,
          vectors: [],
          sectors: [],
          topics: [],
          alerts: {},
          deferredClaim: true,
        }),
      ),
    );
    let status = "reported";
    let responseCandidates = candidates;
    await context.route("**/api/trpc/**", async (route) => {
      const procedures = new URL(route.request().url()).pathname
        .split("/api/trpc/")[1]
        .split(",");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          procedures.map((p) => ({
            result: {
              data: {
                json:
                  p === "civic.getCaliforniaGuide"
                    ? guide
                    : p === "civic.getCaliforniaGuideResults"
                      ? {
                          electionDate: guide.electionDate,
                          sourceUrl: source.sourceUrl,
                          status,
                          candidates: responseCandidates,
                          measures,
                        }
                      : null,
              },
            },
          })),
        ),
      });
    });
    const page = await context.newPage();
    await page.goto(
      process.env.RESULTS_UI_URL || "http://localhost:8098/elections",
    );
    await page.getByText("Explore the guide", { exact: true }).click();
    await page
      .getByText(/60% · 60 votes · Leading/)
      .filter({ visible: true })
      .first()
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `${output}/ui-fixture-candidates-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: new RegExp(
          guide.candidates[0].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      })
      .click();
    await page.waitForURL(/candidate-detail/);
    await page
      .getByText(/60% · 60 votes · Leading/)
      .filter({ visible: true })
      .first()
      .waitFor();
    await page.screenshot({
      path: `${output}/ui-fixture-candidate-detail-${width}.png`,
      fullPage: true,
    });
    await page.goto(
      process.env.RESULTS_UI_URL || "http://localhost:8098/elections",
    );
    await page.getByText("Explore the guide", { exact: true }).click();
    await page.getByText(/^Measures 14$/).click();
    await page.getByText(/Yes 60% · No 40% · Yes is ahead/).waitFor();
    await page
      .getByText(/Yes 50% · No 50% · Tied/)
      .first()
      .waitFor();
    await page.screenshot({
      path: `${output}/ui-fixture-measures-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: new RegExp(`Proposition ${guide.measures[0].number}\\.`),
      })
      .click();
    await page.waitForURL(/proposition-detail/);
    status = "pending";
    await page.goto(
      process.env.RESULTS_UI_URL || "http://localhost:8098/elections",
    );
    await page.getByText("Explore the guide", { exact: true }).click();
    await page.getByText("Results pending", { exact: true }).first().waitFor();
    await page.screenshot({
      path: `${output}/ui-fixture-pending-${width}.png`,
      fullPage: true,
    });
    for (const variant of ["missing", "zero", "tie"]) {
      status = "reported";
      responseCandidates =
        variant === "missing"
          ? {}
          : Object.fromEntries(
              Object.entries(candidates).map(([key, value]) => [
                key,
                {
                  ...value,
                  totalVotes: variant === "zero" ? 0 : 100,
                  votes: variant === "zero" ? 0 : 50,
                  share: variant === "zero" ? 0 : 50,
                  standing: variant === "zero" ? "no-votes" : "tied",
                },
              ]),
            );
      await page.goto(
        process.env.RESULTS_UI_URL || "http://localhost:8098/elections",
      );
      await page.getByText("Explore the guide", { exact: true }).click();
      await page
        .getByText(
          variant === "missing"
            ? "Results unavailable"
            : variant === "zero"
              ? "No votes counted yet"
              : "50% · 50 votes · Tied",
          { exact: true },
        )
        .first()
        .waitFor();
      await page.screenshot({
        path: `${output}/ui-fixture-${variant}-${width}.png`,
        fullPage: true,
      });
    }
    await context.close();
  }
  await browser.close();
  console.log(
    "Verified captured official guide with synthetic UI results at 320, 390 and 1280px.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
