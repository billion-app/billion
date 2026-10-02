const { chromium } = require(process.cwd() + "/node_modules/@playwright/test");
const fs = require("node:fs");
const claim = (text) => ({ text, sourceIds: ["guide"] });
const sourceUrl = "https://voterguide.sos.ca.gov/propositions/";
const measure = {
  number: "5",
  title: "FICTIONAL DEMONSTRATION MEASURE. SCHOOL BOND AUTHORIZATION.",
  sourceUrl,
  officialSummary:
    "Synthetic fixture: authorizes borrowing to pay for school facilities. This is not a real proposition.",
  voteMeaningYes:
    "A YES vote on this measure means: The school district may issue the bonds described in this fictional measure.",
  voteMeaningNo:
    "A NO vote on this measure means: This measure does not authorize the school district to issue those bonds.",
  fiscalImpact:
    "Synthetic fixture: debt repayment depends on the amount borrowed and interest rates. The net fiscal effect is unknown.",
  proArguments: [],
  conArguments: [],
};
const analysis = {
  schemaVersion: 1,
  revision: "fixture-5-v1",
  electionDate: "2026-11-03",
  number: "5",
  officialTitle: measure.title,
  officialUrl: sourceUrl,
  guideHash: "a".repeat(64),
  templateVersion: "consequences-v1",
  generatedAt: "2026-10-01T00:00:00Z",
  model: "synthetic-fixture",
  sources: [
    {
      id: "guide",
      name: "Synthetic guide evidence",
      url: sourceUrl,
      retrievedAt: "2026-10-01T00:00:00Z",
    },
  ],
  headline: claim("Allow borrowing for school buildings"),
  currentRule: claim(
    "The school district does not have authorization to issue the bonds described in this measure.",
  ),
  yes: claim(
    "Authorizes the district to borrow for school facilities. Projects still depend on later funding decisions.",
  ),
  no: claim(
    "Does not authorize this borrowing. It does not cancel other existing school funding.",
  ),
  implementation: [
    claim(
      "The district decides when to sell authorized bonds and allocates proceeds to eligible projects.",
    ),
  ],
  affected: [
    claim(
      "The school district manages the projects. Property owners would fund debt repayment through the described tax.",
    ),
  ],
  costsAndFunding: claim(
    "Borrowed money pays for facilities; the tax repays principal and interest. Total repayment depends on bond sales and interest rates.",
  ),
  uncertainty: claim(
    "The net fiscal effect is unknown. Approval does not guarantee which projects will be completed or when.",
  ),
  review: {
    state: "approved",
    reviewer: "Fixture editor — demonstration only",
    reviewedAt: "2026-10-02T00:00:00Z",
    revision: "fixture-5-v1",
    guideHash: "a".repeat(64),
    findings: "Synthetic fixture",
  },
};
const guide = {
  electionDate: "2026-11-03",
  jurisdiction: "CA",
  complete: true,
  fetchedAt: "2026-10-02T00:00:00Z",
  sourceUrl,
  candidates: [],
  measures: [{ ...measure, consequences: analysis }],
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
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
  await context.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname
      .split("/api/trpc/")[1]
      .split(",");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        procedures.map((p) => ({
          result: {
            data: { json: p === "civic.getCaliforniaGuide" ? response : null },
          },
        })),
      ),
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGE_ERROR", e.message));
  await page.goto("http://localhost:8096/proposition-detail?number=5", {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page
    .getByText("The rule today", { exact: true })
    .waitFor({ timeout: 120000 });
  await page.screenshot({
    path: "docs/screenshots/issue-426/bond-outcomes.png",
    fullPage: true,
  });
  await page
    .getByText("If you vote No", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/issue-426/bond-both-outcomes.png",
    fullPage: true,
  });
  const body = await page.locator("body").innerText();
  for (const text of [
    "If you vote Yes",
    "If you vote No",
    "Conditions and unknowns",
    "Official record",
  ])
    if (!body.includes(text)) throw new Error("Missing " + text);
  response = {
    ...guide,
    measures: [
      {
        ...measure,
        consequences: null,
        officialSummary: undefined,
        fiscalImpact: undefined,
        voteMeaningYes: undefined,
        voteMeaningNo: undefined,
      },
    ],
  };
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText("Start with the official record", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/issue-426/missing-evidence.png",
    fullPage: true,
  });
  response = {
    ...guide,
    measures: [
      {
        ...measure,
        title: "FICTIONAL DEMONSTRATION MEASURE. GOVERNOR SUCCESSION RULE.",
        consequences: {
          ...analysis,
          headline: claim("Change who serves during a vacancy"),
          currentRule: claim(
            "In this fictional example, an appointed temporary officer serves during the specified vacancy.",
          ),
          yes: claim(
            "An elected deputy would serve if the specified vacancy occurs. It does not create a vacancy.",
          ),
          no: claim(
            "The existing temporary appointment rule remains in place.",
          ),
          implementation: [
            claim(
              "The replacement rule applies only when the vacancy condition occurs.",
            ),
          ],
          affected: [
            claim(
              "The Governor, elected deputy and appointing institution would follow the changed succession rule.",
            ),
          ],
          costsAndFunding: claim(
            "Net fiscal effect is unknown. Costs depend on whether a vacancy occurs.",
          ),
          uncertainty: claim(
            "The measure does not predict whether or when the vacancy condition will occur.",
          ),
        },
      },
    ],
  };
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("The rule today", { exact: true }).waitFor();
  await page.screenshot({
    path: "docs/screenshots/issue-426/succession-outcomes.png",
    fullPage: true,
  });
  await page
    .getByText("If you vote No", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/issue-426/succession-both-outcomes.png",
    fullPage: true,
  });
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size: 150% !important; line-height: 1.6 !important;}',
  });
  await page
    .getByText("If you vote No", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/issue-426/succession-enlarged-web-text.png",
    fullPage: true,
  });
  fs.writeFileSync(
    "/tmp/billion-426-rendered.txt",
    await page.locator("body").innerText(),
  );
  console.log(
    "Screens captured; bond, succession, sparse fallback and enlarged web text assertions passed.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
