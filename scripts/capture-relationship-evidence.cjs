// Running Expo web reader; intercepted API uses a source-captured, unapproved draft.
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const capture = JSON.parse(
  fs.readFileSync(
    "packages/api/src/lib/measure-relationship-revisions/ca-2026-pilot.json",
    "utf8",
  ),
);
const draft = capture.draft;
const publicDraft = {
  ...draft,
  sources: draft.sources.map(({ snapshot, ...s }) => s),
};
const guide = {
  electionDate: draft.electionDate,
  jurisdiction: "CA",
  complete: true,
  fetchedAt: draft.sources[0].retrievedAt,
  sourceUrl: "https://voterguide.sos.ca.gov/",
  candidates: [],
  measures: capture.guideMeasures.map((m) => ({
    ...m,
    consequences: null,
    relationships: [publicDraft],
  })),
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() =>
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
    ),
  );
  let response = guide;
  let fail = false;
  await context.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname
      .split("/api/trpc/")[1]
      .split(",");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        procedures.map((p) =>
          fail && p === "civic.getCaliforniaGuide"
            ? {
                error: {
                  json: {
                    message: "Fixture network failure",
                    code: -32603,
                    data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
                  },
                },
              }
            : {
                result: {
                  data: {
                    json: p === "civic.getCaliforniaGuide" ? response : null,
                  },
                },
              },
        ),
      ),
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function label(text) {
    await page.evaluate((text) => {
      let banner = document.getElementById("capture-label");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "capture-label";
        document.body.appendChild(banner);
      }
      banner.textContent = text;
      Object.assign(banner.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        zIndex: 99999,
        background: "#fff",
        color: "#17283f",
        padding: "8px",
        font: "12px sans-serif",
      });
    }, text);
  }
  async function shot(name) {
    await page.screenshot({ path: `docs/evidence/447/${name}.png` });
  }
  async function load(number = 40) {
    await page.goto(
      `http://localhost:8217/proposition-detail?number=${number}`,
      { waitUntil: "networkidle", timeout: 180000 },
    );
    await page
      .getByText("Related measures", { exact: true })
      .last()
      .waitFor({ timeout: 120000 });
    await page
      .getByText("Related measures", { exact: true })
      .last()
      .scrollIntoViewIfNeeded();
    if (
      await page
        .getByRole("button", {
          name: "Explore combined outcomes +",
          exact: true,
        })
        .count()
    )
      await page
        .getByRole("button", {
          name: "Explore combined outcomes +",
          exact: true,
        })
        .last()
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await label("SOURCE-CAPTURED DRAFT · API preview fixture · not published");
  }
  await load();
  await shot("40-collapsed-phone");
  await page
    .getByRole("button", { name: "Explore combined outcomes +", exact: true })
    .last()
    .click();
  await page
    .getByText("Neither passes", { exact: true })
    .last()
    .scrollIntoViewIfNeeded();
  await shot("40-expanded-cases");
  await page
    .getByText("Both pass", { exact: true })
    .last()
    .scrollIntoViewIfNeeded();
  await shot("40-both-pass");
  await page
    .getByText("Which provisions interact?", { exact: true })
    .last()
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot("40-provisions");
  await page
    .getByText("Conditions and unknowns", { exact: true })
    .last()
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot("40-conditions");
  await page
    .getByRole("link", { name: "Read Proposition 42 →", exact: true })
    .scrollIntoViewIfNeeded();
  await page
    .getByRole("link", { name: "Read Proposition 42 →", exact: true })
    .click();
  await page.getByText("Related measures", { exact: true }).last().waitFor();
  await page
    .getByText("Related measures", { exact: true })
    .last()
    .scrollIntoViewIfNeeded();
  await label("SOURCE-CAPTURED DRAFT · other reader · API preview fixture");
  await shot("42-collapsed-phone");
  await page
    .getByRole("button", { name: "Explore combined outcomes +", exact: true })
    .last()
    .click();
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:150% !important;line-height:1.6 !important}',
  });
  await page
    .getByText("Both pass", { exact: true })
    .last()
    .scrollIntoViewIfNeeded();
  await shot("42-enlarged-web-text");
  await page.setViewportSize({ width: 768, height: 1024 });
  await load(42);
  await shot("42-tablet");
  await page.setViewportSize({ width: 390, height: 844 });
  response = {
    ...guide,
    measures: guide.measures.map((m) => ({ ...m, relationships: undefined })),
  };
  await load();
  await label("FIXTURE · unavailable/stale relationship suppressed");
  await shot("unavailable-stale");
  fail = true;
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText("Could not load the guide", { exact: true })
    .last()
    .waitFor({ timeout: 60000 });
  await label("FIXTURE · guide network failure");
  await shot("guide-error");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Running Expo web: both readers, reciprocal navigation, four cases, provisions, unknowns, missing/stale, error, tablet, enlarged web text; no page errors. Native Dynamic Type not verified.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
