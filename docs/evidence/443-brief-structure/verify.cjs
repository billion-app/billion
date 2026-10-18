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
  const output = "docs/evidence/443-brief-structure";
  const checks = [];
  const go = async () => {
    await page.goto(
      "http://localhost:8444/candidate-promise?preview=full&person=morgan&promise=transit",
      { waitUntil: "networkidle", timeout: 120000 },
    );
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("tab", { name: "In brief", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  };
  const scrollTo = async (name) =>
    page
      .getByRole("heading", { name, exact: true })
      .evaluate((el) =>
        el.parentElement.parentElement.scrollIntoView({ block: "start" }),
      );
  await go();
  await page.screenshot({ path: `${output}/01-promise.png` });
  for (const name of ["What’s proposed", "Who decides", "What’s unresolved"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      1,
    );
  }
  await scrollTo("What’s proposed");
  await page.screenshot({ path: `${output}/02-brief.png` });
  await scrollTo("Who decides");
  await page.screenshot({ path: `${output}/03-brief-sources.png` });
  const source = page.getByRole("button", {
    name: "View sources: Who decides",
    exact: true,
  });
  await source.click();
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "City budget and transit responsibilities",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Housing and getting around",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${output}/04-sources.png` });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(source).toBeFocused();
  checks.push(
    "Brief has three question-led sections; authority opens its own supporting source and restores focus",
  );
  await page
    .getByRole("button", { name: "Read the in-depth analysis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Benefits & tradeoffs", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/read=analysis/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "In depth", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  checks.push("In-depth navigation and URL reload");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await go();
    const overflow = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[role="heading"],[role="button"],[role="tab"]',
        ),
      ]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width && (b.left < -0.5 || b.right > innerWidth + 0.5);
        })
        .map((el) => el.textContent),
    );
    expect(overflow).toEqual([]);
    if (width === 320) {
      await scrollTo("What’s proposed");
      await page.screenshot({ path: `${output}/05-brief-320.png` });
    }
    checks.push(`${width}px: headings, tabs and actions fit`);
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${output}/verification.json`,
    JSON.stringify(
      {
        surface: "Expo web development build; fictional transit fixture",
        checks,
        errors,
      },
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
