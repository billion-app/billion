const { chromium, expect } = require("@playwright/test");
const { readFileSync, writeFileSync } = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const cookie = readFileSync("/tmp/research-local-cookie", "utf8");
  await context.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    url.host = "localhost:3000";
    url.protocol = "http:";
    const response = await route.fetch({
      url: url.toString(),
      headers: {
        ...route.request().headers(),
        cookie: "better-auth.session_token=" + cookie,
      },
    });
    await route.fulfill({
      response,
      headers: { ...response.headers(), "access-control-allow-origin": "*" },
    });
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "billion.onboarding.v1",
      JSON.stringify({ completed: true }),
    ),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const draft = "9ba4c5ac-1fb9-47b6-bb7f-3ebd768d7758";
  const output = "docs/evidence/443-plain-language";
  try {
    await page.goto(`http://localhost:8444/candidate-research?draft=${draft}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.getByRole("button", { name: "Explore Ro Khanna" }).click();
    await page.getByRole("button", { name: /Explore promise:/ }).waitFor();
    // Definition controls must not be nested inside the navigation control.
    expect(
      await page
        .getByRole("button", { name: "Define single-payer", exact: true })
        .first()
        .evaluate((el) => !!el.parentElement.closest('button,[role="button"]')),
    ).toBe(false);
    await page.getByRole("button", { name: /Explore promise:/ }).click();
    await page.getByRole("tab", { name: "In brief", exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole("heading", { name: "What could change", exact: true })
      .evaluate((el) =>
        el.parentElement.parentElement.scrollIntoView({ block: "start" }),
      );
    await page.screenshot({ path: `${output}/09-real-brief.png` });
    await page
      .getByRole("button", { name: "Define Congress", exact: true })
      .click();
    await expect(page.getByTestId("inline-term-definition")).toContainText(
      "House of Representatives and the Senate",
    );
    await page
      .getByRole("heading", { name: "Who has to agree", exact: true })
      .evaluate((el) =>
        el.parentElement.parentElement.scrollIntoView({ block: "start" }),
      );
    await page.screenshot({ path: `${output}/10-real-definition.png` });
    await page
      .getByRole("button", {
        name: "Close definition of Congress",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Campaign source: Campaign promise",
        exact: true,
      })
      .click();
    await expect(
      page
        .getByText(
          "I support the creation of a single-payer health care system, or Medicare for All.",
          { exact: false },
        )
        .last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", { name: "Define Medicare for All", exact: true })
      .click();
    await expect(page.getByTestId("inline-term-definition")).toContainText(
      "national public health insurance program",
    );
    await page
      .getByRole("button", {
        name: "Close definition of Medicare for All",
        exact: true,
      })
      .click();
    await page.getByRole("tab", { name: "In depth", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Benefits & tradeoffs", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    writeFileSync(
      `${output}/real-verification.json`,
      JSON.stringify(
        {
          draft,
          source:
            "Fresh CA17 v4 collection in local PostgreSQL; authenticated tRPC with local test session forwarding",
          checks: [
            "Real-source brief, Congress and Medicare for All definitions",
            "Source quotation remains unchanged",
            "Promise cards have separate definition and navigation controls",
            "In-depth navigation",
          ],
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "Real draft definitions, source quotation and navigation passed.",
    );
  } finally {
    await context.unrouteAll({ behavior: "wait" });
    await browser.close();
  }
})().catch(() => {
  console.error(
    "Real draft verification failed; inspect the local UI without logging session headers.",
  );
  process.exit(1);
});
