#!/usr/bin/env ts-node
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
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

  // Find first card by badge text BILL
  const badge = await page.getByText('BILL').first();
  const card = await badge.locator('xpath=ancestor::*[contains(@class, "r-borderRadius-")]').first();
  const cardHtml = await card.evaluate(el => el.outerHTML);
  console.log('Card HTML (first 2000 chars):', cardHtml.substring(0, 2000));

  // Get all child elements with their class and text
  const children = await card.evaluate(el => {
    const result: any[] = [];
    const walk = (node: Element, depth: number) => {
      const tag = node.tagName;
      const className = node.getAttribute('class') || '';
      const text = node.textContent?.trim() || '';
      if (text) {
        result.push({ depth, tag, className, text: text.substring(0, 100) });
      }
      for (const child of Array.from(node.children)) {
        walk(child, depth + 1);
      }
    };
    walk(el, 0);
    return result;
  });
  console.log('\nChild elements with text:');
  children.forEach(c => console.log(`${'  '.repeat(c.depth)}${c.tag} class="${c.className}"\n      text: ${c.text}`));

  // Find title element (maybe largest font size)
  const titleCandidate = await card.evaluate(el => {
    const texts = Array.from(el.querySelectorAll('*')).filter(el => el.textContent?.trim().length > 10);
    if (texts.length) return { tag: texts[0].tagName, className: texts[0].className, text: texts[0].textContent?.substring(0, 100) };
    return null;
  });
  console.log('\nFirst text element:', titleCandidate);

  await browser.close();
})().catch(console.error);