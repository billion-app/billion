import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.instagram.com/');
  await page.getByRole('textbox', { name: 'Mobile number, username or' }).click();
  await page.getByRole('textbox', { name: 'Mobile number, username or' }).fill('billion.news');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Iwantabg:3');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.getByRole('link', { name: 'New post Create' }).click();
  await page.getByRole('button', { name: 'Select from computer' }).click();
  await page.getByRole('button', { name: 'Select from computer' }).setInputFiles('post.png');
  await page.locator('button').filter({ hasText: 'Select crop' }).click();
  await page.getByRole('button', { name: ':5 Crop portrait icon' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('paragraph').click();
  await page.getByRole('paragraph').click();
  await page.getByRole('textbox', { name: 'Write a caption...' }).click();
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
});