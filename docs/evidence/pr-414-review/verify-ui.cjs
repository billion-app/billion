// Run from the repo root against Expo web --no-dev on port 8245.
// GATE=closed ONLY_STATE=lookup-evidence verifies zero personalized requests.
const { chromium } = require(process.cwd() + "/node_modules/@playwright/test");
const fs = require("node:fs");
const out = process.env.EVIDENCE_DIR || __dirname;
const base = process.env.REVIEW_URL || "http://localhost:8245";
const fixture = {
  kind: "civicinfo#voterInfoResponse",
  election: {
    id: "democracy_works:fixture",
    name: "FICTIONAL review election",
    electionDay: "2099-11-03",
    ocdDivisionId: "ocd-division/country:us/state:ca",
  },
  normalizedInput: {
    line1: "123 Example St",
    city: "Example City",
    state: "CA",
    zip: "00000",
  },
  provider: { name: "democracy_works" },
  dropOffLocations: [
    {
      name: "FICTIONAL community center",
      address: {
        line1: "456 Example St",
        city: "Example City",
        state: "CA",
        zip: "00000",
      },
      pollingHours: "Fixture hours only",
      sources: [
        {
          name: "FICTIONAL county election office",
          official: true,
          url: "https://example.org/fixture-location",
        },
      ],
    },
  ],
  officialVotingGuidance: {
    electionDate: "2099-11-03",
    sourceName: "FICTIONAL official guidance",
    sourceUrl: "https://example.org/fixture-guidance",
    fetchedAt: "2026-10-18T12:00:00Z",
    items: [
      {
        kind: "mail_return",
        dateText: "Fixture deadline — not real voting advice",
        text: "Synthetic guidance: check the published postmark and receipt requirements.",
        links: [],
      },
    ],
  },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const [name, path, mode, width, lang] of [
    ["guide-en", "/how-to-vote-guide", "empty", 390, "en"],
    ["guide-es", "/how-to-vote-guide", "empty", 320, "es"],
    ["guide-zh", "/how-to-vote-guide", "empty", 390, "zh"],
    ["lookup-empty", "/how-to-vote", "empty", 390, "en"],
    [
      "lookup-error",
      "/how-to-vote?address=invalid%20address",
      "error",
      390,
      "en",
    ],
    [
      "lookup-evidence",
      "/how-to-vote?address=123%20Example%20St&method=dropBox",
      "ready",
      390,
      "en",
    ],
    [
      "lookup-evidence-es",
      "/how-to-vote?address=123%20Example%20St&method=dropBox",
      "ready",
      320,
      "es",
    ],
    [
      "lookup-sparse",
      "/how-to-vote?address=123%20Example%20St",
      "sparse",
      390,
      "en",
    ],
  ].filter(
    (row) => !process.env.ONLY_STATE || row[0] === process.env.ONLY_STATE,
  )) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).origin === new URL(base).origin
        ? r.continue()
        : r.abort(),
    );
    await context.addInitScript(
      ({ lang }) => {
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
        );
        localStorage.setItem("billion.language.v1", lang);
      },
      { lang },
    );
    await context.route("**/api/trpc/**", (r) => {
      const procedures = new URL(r.request().url()).pathname
        .split("/api/trpc/")[1]
        .split(",");
      if (
        process.env.GATE === "closed" &&
        procedures.includes("civic.getVoterInfo")
      )
        throw new Error("Closed production gate requested voter info");
      const replies = procedures.map((p) => {
        if (mode === "error" && p === "civic.getVoterInfo")
          return {
            error: {
              json: {
                message: "Synthetic invalid address failure",
                code: -32603,
                data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
              },
            },
          };
        const json =
          p === "civic.getBallotAvailability"
            ? { lookupEnabled: process.env.GATE !== "closed" }
            : p === "civic.getVoterInfo"
              ? mode === "sparse"
                ? {
                    ...fixture,
                    dropOffLocations: [],
                    officialVotingGuidance: undefined,
                  }
                : fixture
              : null;
        return { result: { data: { json } } };
      });
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(replies),
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + path, { timeout: 120000 });
    await page.waitForFunction(() => document.body.innerText.length > 80, {
      timeout: 120000,
    });
    await page.waitForTimeout(2500);
    if (
      (await page.locator("body").innerText()).includes("Something went wrong")
    )
      throw new Error(name + ": route error boundary rendered");
    await page.screenshot({ path: `${out}/${name}.png` });
    fs.writeFileSync(
      `${out}/${name}.txt`,
      await page.locator("body").innerText(),
    );
    if (name.includes("guide") || name.includes("evidence")) {
      for (const [suffix, offset] of [
        ["middle", 650],
        ["lower", 1300],
      ]) {
        await page.evaluate((y) => {
          for (const el of document.querySelectorAll("*"))
            if (
              el.scrollHeight > el.clientHeight &&
              getComputedStyle(el).overflowY.match(/auto|scroll/)
            )
              el.scrollTop = y;
        }, offset);
        await page.screenshot({ path: `${out}/${name}-${suffix}.png` });
      }
    }
    if (name === "lookup-error" && process.env.GATE !== "closed") {
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByRole("textbox").waitFor();
      await page.screenshot({ path: `${out}/lookup-error-edit.png` });
    }
    if (name === "lookup-evidence" && process.env.GATE !== "closed") {
      const text = await page.locator("body").innerText();
      for (const expected of [
        "FICTIONAL official guidance",
        "Fixture deadline",
        "FICTIONAL county election office",
      ])
        if (!text.includes(expected))
          throw new Error("Missing source evidence: " + expected);
    }
    console.log(name, JSON.stringify(errors));
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
