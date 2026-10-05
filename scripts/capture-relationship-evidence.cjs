// Actual Expo web app. The API intercept previews source-captured pending copy.
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const capture = JSON.parse(
  fs.readFileSync(
    "packages/api/src/lib/measure-relationship-revisions/ca-2026-pilot.json",
    "utf8",
  ),
);
const draft = capture.draft;
const publicDraft = {
  ...draft,
  sources: draft.sources.map(({ snapshot, ...source }) => source),
};
const guide = {
  electionDate: draft.electionDate,
  jurisdiction: "CA",
  complete: true,
  fetchedAt: draft.sources[0].retrievedAt,
  sourceUrl: "https://voterguide.sos.ca.gov/",
  candidates: [],
  measures: capture.guideMeasures.map((measure) => ({
    ...measure,
    consequences: null,
    relationships: [publicDraft],
  })),
};
let browser;
(async () => {
  browser = await chromium.launch({ headless: true });
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
        procedures.map((procedure) =>
          fail && procedure === "civic.getCaliforniaGuide"
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
                    json:
                      procedure === "civic.getCaliforniaGuide"
                        ? response
                        : null,
                  },
                },
              },
        ),
      ),
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  const shot = (name) =>
    page.screenshot({ path: `docs/evidence/447/${name}.png` });
  const card = () => page.getByTestId(`relationship-${draft.revision}`).last();
  async function position(locator) {
    await locator.evaluate((element) => {
      element.scrollIntoView({ block: "start" });
      let parent = element.parentElement;
      while (
        parent &&
        !(
          parent.scrollHeight > parent.clientHeight &&
          /auto|scroll/.test(getComputedStyle(parent).overflowY)
        )
      )
        parent = parent.parentElement;
      if (parent) parent.scrollTop -= 72;
    });
  }
  async function load(number = draft.measures[0].number) {
    await page.goto(
      `http://localhost:8217/proposition-detail?number=${number}`,
      { waitUntil: "networkidle", timeout: 180000 },
    );
    await page
      .getByTestId("measure-relationships")
      .last()
      .waitFor({ timeout: 120000 });
    await position(page.getByTestId("measure-relationships").last());
    await label("SOURCE-CAPTURED DRAFT · intercepted API · not published");
  }
  async function choose(id) {
    const names = {
      neither: "Neither measure passes",
      onlyFirst: `Only Proposition ${draft.measures[0].number} passes`,
      onlySecond: `Only Proposition ${draft.measures[1].number} passes`,
      both: "Both measures pass",
    };
    await card().getByRole("button", { name: names[id], exact: true }).click();
    const result = card().getByTestId("relationship-selected-outcome");
    assert.equal(
      await result.innerText(),
      `${draft.compact.scenarios[id].title.text}\n${draft.compact.scenarios[id].consequence.text}`,
    );
    for (const other of Object.keys(draft.compact.scenarios))
      if (other !== id)
        assert.equal(
          await result
            .getByText(draft.compact.scenarios[other].title.text, {
              exact: true,
            })
            .count(),
          0,
        );
    assert.equal(
      await card()
        .getByRole("button", { name: names[id], exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await card()
        .getByRole("button", {
          name: "How Yes totals could matter",
          exact: true,
        })
        .count(),
      id === "both" ? 1 : 0,
    );
  }
  await load();
  await shot("40-collapsed-phone");
  if (process.argv.includes("--phone-preview")) {
    console.log(
      "Phone prototype captured; remaining verification deliberately not run.",
    );
    await browser.close();
    return;
  }
  for (const [id, name] of [
    ["neither", "40-neither"],
    ["onlyFirst", "40-only-first"],
    ["onlySecond", "40-only-second"],
    ["both", "40-both-pass"],
  ]) {
    await choose(id);
    await position(page.getByTestId("measure-relationships").last());
    await shot(name);
  }
  await card()
    .getByRole("button", { name: "How Yes totals could matter", exact: true })
    .click();
  await position(card().getByTestId("relationship-selected-outcome"));
  await shot("40-vote-totals");
  await card()
    .getByRole("button", { name: "How Yes totals could matter", exact: true })
    .click();
  await card()
    .getByRole("button", { name: "Which rules overlap?", exact: true })
    .click();
  await position(card().getByTestId("relationship-provisions"));
  await shot("40-provisions");
  await card()
    .getByRole("button", { name: "Which rules overlap?", exact: true })
    .click();
  await card()
    .getByRole("button", { name: "Sources & conditions", exact: true })
    .click();
  await position(card().getByTestId("relationship-evidence"));
  await shot("40-conditions");
  await card()
    .getByRole("button", { name: "Sources & conditions", exact: true })
    .click();
  await card()
    .getByRole("link", {
      name: `Read Proposition ${draft.measures[1].number}: ${draft.compact.measures[1].text}`,
      exact: true,
    })
    .click();
  await card()
    .getByRole("button", { name: "Both measures pass", exact: true })
    .waitFor();
  await position(page.getByTestId("measure-relationships").last());
  await label("SOURCE-CAPTURED DRAFT · reciprocal reader · not published");
  await shot("42-collapsed-phone");
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size:150% !important;line-height:1.6 !important}',
  });
  await position(page.getByTestId("measure-relationships").last());
  await shot("42-enlarged-web-text");
  await position(card().getByTestId("relationship-selected-outcome"));
  await shot("42-enlarged-web-outcome");
  await page.setViewportSize({ width: 768, height: 1024 });
  await load(draft.measures[1].number);
  await shot("42-tablet");
  await page.setViewportSize({ width: 390, height: 844 });
  response = {
    ...guide,
    measures: guide.measures.map((measure) => ({
      ...measure,
      relationships: undefined,
    })),
  };
  await page.goto(
    "http://localhost:8217/proposition-detail?number=" +
      draft.measures[0].number,
  );
  await page.getByText("Official record", { exact: true }).last().waitFor();
  assert.equal(await page.getByTestId("measure-relationships").count(), 0);
  await label("FIXTURE · no relevant approved relationships · section omitted");
  await shot("unavailable-stale");
  fail = true;
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText("Could not load the guide", { exact: true })
    .last()
    .waitFor({ timeout: 60000 });
  await label("FIXTURE · guide network failure");
  await shot("guide-error");
  assert.deepEqual(errors, []);
  console.log(
    "Running Expo web verified: one selected consequence, all four case controls/selected state, conditional vote comparison, provisions/evidence disclosures, reciprocal navigation, phone/tablet/enlarged web text, empty/old-API section omission and error fallback. No page errors. Native Dynamic Type remains unverified.",
  );
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
