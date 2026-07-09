import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  baseURL: process.env.BASE_URL ?? "http://localhost:8081",
});

try {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const cards = page.getByTestId("content-card");
  console.log(`Found ${await cards.count()} browse cards`);
  console.log(
    `Found ${await page.getByTestId("content-card-badge").count()} card badges`,
  );
  console.log(
    `Found ${await page.getByTestId("content-card-title").count()} card titles`,
  );
} finally {
  await browser.close();
}
