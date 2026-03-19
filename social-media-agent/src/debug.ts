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

  // Get all elements with any class
  const classNames = await page.evaluate(() => {
    const elements = document.querySelectorAll('*[class]');
    const classes: string[] = [];
    elements.forEach(el => {
      const cls = el.getAttribute('class');
      if (cls) classes.push(cls);
    });
    return classes;
  });

  console.log('Total elements with class attribute:', classNames.length);
  // Count unique class names
  const unique = [...new Set(classNames)];
  console.log('Unique class names:', unique.length);
  // Print first 20 unique class names
  unique.slice(0, 20).forEach(c => console.log('  ', c));

  // Get outer HTML of body to inspect structure
  const bodyHTML = await page.evaluate(() => document.body.outerHTML.length);
  console.log('Body HTML length:', bodyHTML);

  // Find any elements that might be cards
  const cardCandidates = await page.evaluate(() => {
    const elements = document.querySelectorAll('div, section, article');
    const candidates: Array<{tag: string, className: string, text: string}> = [];
    elements.forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.length > 10 && text.length < 500) {
        candidates.push({
          tag: el.tagName,
          className: el.getAttribute('class') || '',
          text: text.substring(0, 100) + '...',
        });
      }
    });
    return candidates.slice(0, 10);
  });

  console.log('\nPossible card elements:');
  cardCandidates.forEach((c, i) => {
    console.log(`  ${i+1}. ${c.tag} class="${c.className}"`);
    console.log(`     Text: ${c.text}`);
  });

  // Take screenshot for visual inspection
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to debug-screenshot.png');

  await browser.close();
})().catch(console.error);