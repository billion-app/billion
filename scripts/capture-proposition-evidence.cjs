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
  decisionNote: claim(
    "If bonds are issued, property owners repay them through a tax.",
  ),
  implementation: [
    claim(
      "The district decides when to borrow and which allowed projects receive the money.",
    ),
  ],
  affected: [
    claim(
      "The school district manages the projects. Property owners would fund debt repayment through the described tax.",
    ),
  ],
  costsAndFunding: claim(
    "Borrowed money pays for facilities; the tax repays the loan and interest. Total repayment depends on how much is borrowed and interest rates.",
  ),
  uncertainty: claim(
    "The overall effect on public budgets is unknown. Approval does not guarantee which projects will be completed or when.",
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
let browser;
(async () => {
  browser = await chromium.launch({ headless: true });
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
  let failGuide = false;
  await context.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname
      .split("/api/trpc/")[1]
      .split(",");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        procedures.map((p) => ({
          ...(failGuide && p === "civic.getCaliforniaGuide"
            ? {
                error: {
                  json: {
                    message: "Synthetic guide failure",
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
              }),
        })),
      ),
    });
  });
  const page = await context.newPage();
  const resetScroll = async () => {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll("*"))
        if (element.scrollTop) element.scrollTop = 0;
      window.scrollTo(0, 0);
    });
  };
  page.on("pageerror", (e) => console.log("PAGE_ERROR", e.message));
  await page.goto("http://localhost:8096/proposition-detail?number=5", {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page
    .getByText("The rule today", { exact: true })
    .waitFor({ timeout: 120000 });
  const noBounds = await page
    .getByText(analysis.no.text, { exact: true })
    .boundingBox();
  if (!noBounds || noBounds.y + noBounds.height > 844)
    throw new Error("Full No outcome is outside the initial viewport");
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
  await page
    .getByRole("button", { name: "Official ballot title", exact: true })
    .click();
  await page.getByText(measure.title, { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Official ballot title", exact: true })
    .click();
  const body = await page.locator("body").innerText();
  for (const text of [
    "If you vote Yes",
    "If you vote No",
    "Limits and unknowns",
    "Official record",
  ])
    if (!body.includes(text)) throw new Error("Missing " + text);
  response = { ...guide, measures: [{ ...measure, consequences: null }] };
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("What your vote means", { exact: true }).waitFor();
  await resetScroll();
  await page.screenshot({
    path: "docs/screenshots/issue-426/official-fallback.png",
    fullPage: true,
  });
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
    .getByText(
      "Billion’s explanation and a complete official Yes/No comparison aren’t available here yet.",
      { exact: true },
    )
    .waitFor();
  if (
    (await page.locator("body").innerText()).includes(
      "The state’s voting outcomes and fiscal analysis are below",
    )
  )
    throw new Error("Sparse fallback promises missing evidence");
  await resetScroll();
  const guideAction = page.getByRole("link", {
    name: "Open official voter guide",
    exact: true,
  });
  const actionBounds = await guideAction.boundingBox();
  if (!actionBounds || actionBounds.y + actionBounds.height > 844)
    throw new Error("Sparse official guide action is offscreen");
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
        officialSummary:
          "Synthetic fixture: changes the temporary officer during the specified vacancy to an elected deputy. This is not a real proposition.",
        voteMeaningYes:
          "A YES vote on this measure means: An elected deputy serves if the Governor leaves office before the term ends.",
        voteMeaningNo:
          "A NO vote on this measure means: An appointed official would continue to serve temporarily.",
        fiscalImpact:
          "Synthetic fixture: net fiscal effect is unknown and depends on whether a vacancy occurs.",
        consequences: {
          ...analysis,
          decisionNote: undefined,
          sources: [
            ...analysis.sources,
            {
              id: "law",
              name: "Synthetic succession law",
              url: "https://voterguide.sos.ca.gov/propositions/5/title-summary.htm",
              retrievedAt: "2026-10-01T00:00:00Z",
            },
          ],
          officialTitle:
            "FICTIONAL DEMONSTRATION MEASURE. GOVERNOR SUCCESSION RULE.",
          headline: claim("Change who serves during a vacancy"),
          currentRule: claim(
            "An appointed official temporarily serves if the Governor leaves office before the term ends.",
          ),
          yes: claim(
            "An elected deputy would serve if the Governor leaves office before the term ends.",
          ),
          no: claim(
            "An appointed official would continue to serve temporarily.",
          ),
          implementation: [
            claim(
              "If the Governor leaves office before the term ends, the elected deputy takes over under the new rule.",
            ),
          ],
          affected: [
            claim(
              "The office responsible for appointing a temporary replacement would no longer choose who serves.",
            ),
            {
              text: "The elected deputy would have to take over the Governor’s duties.",
              sourceIds: ["law"],
            },
          ],
          costsAndFunding: claim(
            "The overall effect on public budgets is unknown. Costs depend on whether the Governor leaves office early.",
          ),
          uncertainty: claim(
            "This changes the replacement rule. It does not remove the Governor from office or predict an early departure.",
          ),
        },
      },
    ],
  };
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("The rule today", { exact: true }).waitFor();
  await resetScroll();
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
  await page
    .getByText("Limits and unknowns", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/issue-426/succession-costs-uncertainty.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Sources and review/ }).click();
  await page
    .getByRole("button", {
      name: "Cited statements from Synthetic guide evidence",
      exact: true,
    })
    .click();
  const guideEvidence = page.getByTestId("proposition-source-guide");
  if (
    await guideEvidence
      .getByText(
        "The elected deputy would have to take over the Governor’s duties.",
        { exact: true },
      )
      .count()
  )
    throw new Error("Guide source claimed an unsupported statement");
  await guideEvidence
    .getByText(
      "The office responsible for appointing a temporary replacement would no longer choose who serves.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", {
      name: "Cited statements from Synthetic guide evidence",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Cited statements from Synthetic succession law",
      exact: true,
    })
    .click();
  const lawEvidence = page.getByTestId("proposition-source-law");
  await lawEvidence
    .getByText(
      "The elected deputy would have to take over the Governor’s duties.",
      { exact: true },
    )
    .waitFor();
  if (
    await lawEvidence
      .getByText(
        "The office responsible for appointing a temporary replacement would no longer choose who serves.",
        { exact: true },
      )
      .count()
  )
    throw new Error("Law source claimed an unsupported statement");
  await lawEvidence.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/issue-426/source-review.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Cited statements from Synthetic succession law",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Sources and review/ }).click();
  await page.getByRole("button", { name: /How this would work/ }).click();
  await page
    .getByText("How the change takes effect", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: /How this would work/ }).click();
  await page
    .getByRole("button", { name: /Official Yes\/No descriptions/ })
    .click();
  await page
    .getByText(
      "An elected deputy serves if the Governor leaves office before the term ends.",
      {
        exact: true,
      },
    )
    .waitFor();
  await page
    .getByText("An appointed official would continue to serve temporarily.", {
      exact: true,
    })
    .last()
    .waitFor();
  if ((await page.locator("body").innerText()).includes("school facilities"))
    throw new Error("Succession fixture inherited bond evidence");
  await page
    .getByRole("button", { name: /Official Yes\/No descriptions/ })
    .click();
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
  await page.addStyleTag({
    content:
      '[dir="auto"] {font-size: revert !important; line-height: revert !important;}',
  });
  failGuide = true;
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByText("Could not load the guide", { exact: true })
    .waitFor({ timeout: 60000 });
  await page.screenshot({
    path: "docs/screenshots/issue-426/guide-error.png",
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
})().catch(async (e) => {
  await browser?.close();
  console.error(e);
  process.exitCode = 1;
});
