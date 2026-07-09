import { test } from "@playwright/test";

test("browse cards expose the social agent contract", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("content-card").first().waitFor({ state: "visible" });
  await page.getByText("All", { exact: true }).first().click();
  await page.getByTestId("content-card").first().click();
  await page.getByTestId("article-title").waitFor({ state: "visible" });
  await page.getByText("Original text", { exact: true }).click();
  await page.getByText("Plain explainer", { exact: true }).click();
});
