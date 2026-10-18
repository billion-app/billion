const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
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
  const base = "http://localhost:8444";
  const checks = [];
  const go = async (path) => {
    await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async (name) =>
    page.screenshot({ path: `docs/evidence/443-native/${name}.png` });
  await go("/candidate-research?preview=full");
  await expect(
    page.getByRole("button", { name: "Explore Morgan Lee" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore Morgan Lee" }).click();
  await expect(
    page.getByRole("heading", { name: "Record & promises" }),
  ).toBeVisible();
  checks.push("roster → candidate");
  await shot("01-candidate-web");
  await page.getByRole("button", { name: /Read the record:/ }).click();
  await expect(
    page.getByRole("heading", { name: "Council meeting minutes" }),
  ).toBeVisible();
  await expect(
    page.getByText("What it doesn’t", { exact: true }),
  ).toBeVisible();
  await shot("03-evidence-web");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Read the record:/ }),
  ).toBeFocused();
  checks.push("source sheet, Done and focus restoration");
  await page.getByRole("button", { name: /Explore promise:/ }).click();
  await expect(page).toHaveURL(/candidate-promise.*promise=transit/);
  await expect(
    page.getByRole("tab", { name: "In brief", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await shot("04-promise-brief-web");
  await page.getByRole("tab", { name: "In depth", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Benefits & tradeoffs" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Benefits & tradeoffs" })
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot("05-promise-analysis-web");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "In depth", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  checks.push("promise page, depth, URL reload");
  await go("/candidate-research?preview=full&person=morgan&tab=money");
  await expect(
    page.getByRole("heading", { name: "Donors & interests" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Donors & interests" })
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot("06-money-web");
  await page
    .getByRole("button", { name: /Jordan Bell,.*View donor details/ })
    .click();
  await expect(
    page.getByText("Interest not established", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registered lobbyist", exact: true }),
  ).toBeVisible();
  await shot("07-donor-web");
  checks.push("donor identity, role and unknown interest distinct");
  await go("/candidate-research?preview=full&person=morgan&tab=money");
  await page
    .getByRole("button", { name: "Filter donors", exact: true })
    .click();
  await page.getByRole("tab", { name: "Lobbyists", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /Neighborhood Workers Committee,.*View donor details/,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Jordan Bell,.*View donor details/ }),
  ).toHaveCount(1);
  checks.push("donor filters");
  await go("/candidate-research?preview=full&view=compare");
  for (const name of ["Morgan Lee", "Alex Rivera", "Sam Taylor"])
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      1,
    );
  await shot("08-comparison-web");
  checks.push("comparison preserves full roster and gaps");
  await go("/candidate-research?preview=withdrawn&view=compare");
  await expect(
    page.getByText("Withdrawn; name remains on ballot", { exact: true }),
  ).toBeVisible();
  checks.push("withdrawal remains visible in comparison");
  await go("/candidate-research?preview=sparse&person=morgan&tab=money");
  await expect(
    page.getByRole("heading", { name: "Campaign finance unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("$0", { exact: true })).toHaveCount(0);
  await shot("09-sparse-web");
  checks.push("missing financial data is not zero");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/candidate-research?preview=full&person=morgan",
      "/candidate-promise?preview=full&person=morgan&promise=transit&read=analysis",
      "/candidate-research?preview=full&person=morgan&tab=money",
    ]) {
      await go(route);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('[role="heading"],[role="button"],input')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width && (b.left < -0.5 || b.right > innerWidth + 0.5);
          })
          .map((el) => el.textContent),
      );
      expect(overflow).toEqual([]);
    }
    checks.push(`${width}px: candidate, promise, finance fit`);
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    "docs/evidence/443-native/verification.json",
    JSON.stringify(
      { surface: "Expo web development build; fictional data", checks, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
