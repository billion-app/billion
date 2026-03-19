import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:8081/');
  await page.locator('div').filter({ hasText: /^Orders$/ }).first().click();
  await page.getByText('ORDERThe SAVE America Act Is').click();
  await page.goto('http://localhost:8081/');
  await page.locator('div').filter({ hasText: /^Orders$/ }).first().click();
  await page.getByText('ORDERThe SAVE America Act Is').click();
  await page.goto('http://localhost:8081/');
  await page.locator('div').filter({ hasText: /^Bills$/ }).first().click();
  await page.getByText('BILLFederal Employee Return').click();
  await page.locator('div').filter({ hasText: /^Original$/ }).first().click();
  await page.locator('div').filter({ hasText: /^Article$/ }).first().click();
  await page.locator('div').filter({ hasText: /^Cases$/ }).first().click();
  await page.locator('div').filter({ hasText: /^All$/ }).first().click();
});