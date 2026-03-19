#!/usr/bin/env ts-node
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    baseURL: 'http://localhost:8081',
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Try XPath to find cards
  const cardXPath = `//*[contains(@class, 'r-borderRadius-1q9bdsx')]`;
  const cards = await page.locator(cardXPath).all();
  console.log(`Found ${cards.length} cards with XPath`);

  // Try to find badge text
  const badgeTexts = ['BILL', 'CASE', 'ORDER', 'NEWS'];
  for (const text of badgeTexts) {
    const elements = await page.getByText(text).all();
    console.log(`Found ${elements.length} elements with text "${text}"`);
    if (elements.length > 0) {
      // Get parent card
      const parent = await elements[0].locator('xpath=ancestor::*[contains(@class, "r-borderRadius-")]').first();
      const count = await parent.count();
      console.log(`Parent card exists: ${count}`);
    }
  }

  // Try to locate via Read More text
  const readMoreButtons = await page.getByText('Read More →').all();
  console.log(`Read More buttons: ${readMoreButtons.length}`);
  for (let i = 0; i < readMoreButtons.length; i++) {
    const button = readMoreButtons[i];
    // Get parent card
    const card = button.locator('xpath=ancestor::*[contains(@class, "r-borderRadius-")]').first();
    const title = await card.locator('text').first().textContent();
    console.log(`Card ${i} title: ${title?.substring(0, 50)}`);
  }

  await browser.close();
})().catch(console.error);