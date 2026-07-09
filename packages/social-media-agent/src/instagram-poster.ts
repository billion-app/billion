import * as fs from "fs";
import * as path from "path";
import type { Browser, BrowserContext, Locator, Page } from "playwright";
import { chromium } from "playwright";

import { defaultInstagramPostsDir } from "./paths";

interface InstagramPostPayload {
  postName: string;
  caption: string;
  description: string;
  imageFile: string;
  category: string;
  sourceUrl?: string;
  generatedAt: string;
}

interface LoadedInstagramPost {
  folderPath: string;
  jsonPath: string;
  imagePath: string;
  payload: InstagramPostPayload;
}

export interface InstagramPosterOptions {
  postJsonPaths: string[];
  headless?: boolean;
  username?: string;
  password?: string;
}

export interface InstagramTestOptions {
  headless?: boolean;
  username?: string;
  password?: string;
  postJsonPath?: string;
  loginOnly?: boolean;
  pauseMs?: number;
}

const STEP_DELAY_MS = 1500;
// Delay between individual keystrokes when typing the caption (ms)
const CAPTION_TYPE_DELAY_MS = 25;
// How long to wait after clicking Share before checking for confirmation (ms)
const POST_SHARE_SETTLE_MS = 5000;
// How long to wait after the browser is done before closing it (ms)
const BROWSER_CLOSE_SETTLE_MS = 4000;

function getCredentials(options: { username?: string; password?: string }): {
  username: string;
  password: string;
} {
  const username = options.username ?? process.env.INSTAGRAM_USERNAME;
  const password = options.password ?? process.env.INSTAGRAM_PASSWORD;
  console.log(`Using Instagram username: ${username ? "***" : "not provided"}`);
  console.log(`Using Instagram password: ${password ? "***" : "not provided"}`);
  if (!username || !password) {
    throw new Error(
      "INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD are required to use the Instagram poster.",
    );
  }

  return { username, password };
}

function readPost(jsonPath: string): LoadedInstagramPost {
  const absoluteJsonPath = path.resolve(jsonPath);
  const folderPath = path.dirname(absoluteJsonPath);
  const payload = JSON.parse(
    fs.readFileSync(absoluteJsonPath, "utf-8"),
  ) as InstagramPostPayload;
  const imagePath = path.resolve(folderPath, payload.imageFile);

  if (!fs.existsSync(imagePath)) {
    throw new Error(
      `Image file not found for ${absoluteJsonPath}: ${imagePath}`,
    );
  }

  return {
    folderPath,
    jsonPath: absoluteJsonPath,
    imagePath,
    payload,
  };
}

export function findLatestInstagramPostJson(
  rootDir: string = defaultInstagramPostsDir,
): string {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`instagram-posts directory not found: ${rootDir}`);
  }

  const candidates = fs
    .readdirSync(rootDir)
    .map((entry) => path.join(rootDir, entry, "post.json"))
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({
      path: candidate,
      mtimeMs: fs.statSync(candidate).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No post.json files found under ${rootDir}`);
  }

  return candidates[0]!.path;
}

async function clickIfVisible(locator: Locator): Promise<boolean> {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }

  return false;
}

async function dismissPostLoginPrompts(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await clickIfVisible(
      page.getByRole("button", { name: /not now/i }).first(),
    ).catch(() => undefined);
    await clickIfVisible(
      page.getByRole("button", { name: /cancel/i }).first(),
    ).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
}

async function dismissPreLoginPrompts(page: Page): Promise<void> {
  await clickIfVisible(
    page
      .getByRole("button", { name: /allow all cookies|accept all cookies/i })
      .first(),
  ).catch(() => undefined);
  await clickIfVisible(
    page
      .getByRole("button", {
        name: /decline optional cookies|only allow essential cookies/i,
      })
      .first(),
  ).catch(() => undefined);
}

async function waitForLoggedIn(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");

  try {
    await page.waitForURL(/instagram\.com\/(?!accounts\/login)/, {
      timeout: 30000,
    });
  } catch {
    const challengeText = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    if (challengeText?.match(/challenge|required|suspend|confirm it'?s you/i)) {
      throw new Error(
        "Instagram interrupted login with a challenge/checkpoint. Complete that in the browser and retry.",
      );
    }

    throw new Error("Instagram login did not complete within 30 seconds.");
  }
}

async function slowStep(
  page: Page,
  label: string,
  delayMs: number = STEP_DELAY_MS,
): Promise<void> {
  console.log(label);
  if (delayMs > 0) {
    await page.waitForTimeout(delayMs);
  }
}

async function createInstagramSession(
  headless: boolean,
): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless,
    args: ["--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  return { browser, context, page };
}

export async function loginToInstagram(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "domcontentloaded",
  });
  await dismissPreLoginPrompts(page);
  await slowStep(page, "Instagram login page loaded.");
  // u see the enter username and password lines, *I* wrote that, emphasize *I* wrote that, not some AI, *I* wrote that, and *I* am proud of it. I will not change it to something more generic because I want to remember that *I* wrote it, and *I* am proud of it.
  await page
    .getByRole("textbox", { name: "Mobile number, username or" })
    .click();
  await page
    .getByRole("textbox", { name: "Mobile number, username or" })
    .fill(username);

  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await slowStep(page, "Instagram credentials entered.");

  await page
    .getByRole("button", { name: /^log in$/i })
    .first()
    .click();
  await slowStep(page, "Instagram login submitted.");

  await waitForLoggedIn(page);
  await dismissPostLoginPrompts(page);
  await slowStep(page, "Instagram post-login popups handled.");
}

async function openComposer(page: Page): Promise<void> {
  await page.goto("https://www.instagram.com/", {
    waitUntil: "domcontentloaded",
  });
  // FIX: replaced waitForLoadState('networkidle') — it hangs indefinitely on Instagram.
  // Instead, wait for a known UI landmark that confirms the home feed is interactive.
  await page
    .waitForSelector(
      'a[href="/create/select/"], svg[aria-label="New post"], a[href*="create"]',
      {
        timeout: 15000,
      },
    )
    .catch(() => undefined);
  await slowStep(page, "Instagram home loaded.");

  const createTriggers: Locator[] = [
    page.getByRole("link", { name: /new post|create/i }).first(),
    page.getByRole("button", { name: /new post|create/i }).first(),
    page.locator('a[href="/create/select/"]').first(),
    page.locator('svg[aria-label="New post"]').locator("xpath=..").first(),
  ];

  let opened = false;
  for (const trigger of createTriggers) {
    if (await clickIfVisible(trigger).catch(() => false)) {
      opened = true;
      break;
    }
  }

  if (!opened) {
    throw new Error("Could not open the Instagram composer.");
  }
  await slowStep(page, "Instagram composer opened.");

  const selectFromComputer = page
    .getByRole("button", { name: /select from computer/i })
    .first();
  if (await selectFromComputer.isVisible().catch(() => false)) {
    await selectFromComputer.click();
    await slowStep(page, "Select from computer clicked.");
  }
}

async function uploadImage(page: Page, imagePath: string): Promise<void> {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 15000 });
  await fileInput.setInputFiles(imagePath);
  await slowStep(page, `Instagram image uploaded: ${path.basename(imagePath)}`);
}

async function advanceToCaptionScreen(page: Page): Promise<void> {
  const cropButton = page
    .locator("button")
    .filter({ hasText: /select crop/i })
    .first();
  if (await cropButton.isVisible().catch(() => false)) {
    await cropButton.click();
    await slowStep(page, "Instagram crop options opened.");
    const portraitButton = page
      .getByRole("button", { name: /crop portrait/i })
      .first();
    if (await portraitButton.isVisible().catch(() => false)) {
      await portraitButton.click();
      await slowStep(page, "Instagram portrait crop selected.");
    }
  }

  const firstNextButton = page.getByRole("button", { name: /^next$/i }).first();
  await firstNextButton.waitFor({ state: "visible", timeout: 15000 });
  await firstNextButton.click();
  await slowStep(page, "Instagram first Next clicked.");

  const secondNextButton = page
    .getByRole("button", { name: /^next$/i })
    .first();
  await secondNextButton.waitFor({ state: "visible", timeout: 15000 });
  await secondNextButton.click();
  await slowStep(page, "Instagram second Next clicked.");
}

async function fillCaption(page: Page, caption: string): Promise<void> {
  const captionBox = page
    .locator(
      [
        'textarea[aria-label="Write a caption..."]',
        'div[aria-label="Write a caption..."][contenteditable="true"]',
      ].join(", "),
    )
    .first();

  await captionBox.waitFor({ state: "visible", timeout: 15000 });
  await captionBox.click();
  // FIX: replaced fill() (instant) with keyboard.type() so Instagram's React
  // input receives individual keydown/keypress/keyup events and registers the text.
  await page.keyboard.type(caption, { delay: CAPTION_TYPE_DELAY_MS });
  await slowStep(page, "Instagram caption filled.");
}

async function sharePost(page: Page): Promise<void> {
  const shareButton = page.getByRole("button", { name: /^share$/i }).first();
  await shareButton.waitFor({ state: "visible", timeout: 15000 });
  await shareButton.click();
  console.log("Instagram Share clicked — waiting for submission to settle...");

  // FIX: give Instagram time to actually submit the post before racing on the
  // confirmation UI, which can appear/disappear faster than Playwright can catch it.
  await page.waitForTimeout(POST_SHARE_SETTLE_MS);

  await Promise.race([
    page
      .getByText(/your post has been shared|post shared/i)
      .first()
      .waitFor({ state: "visible", timeout: 45000 }),
    page
      .getByRole("button", { name: /^close$/i })
      .first()
      .waitFor({ state: "visible", timeout: 45000 }),
  ]).catch(() => {
    // Not throwing here — the post may have gone through even if the confirmation
    // UI was missed. Log a warning and let the caller decide.
    console.warn(
      "Instagram did not show a share confirmation — the post may still have been submitted.",
    );
  });

  await clickIfVisible(
    page.getByRole("button", { name: /^close$/i }).first(),
  ).catch(() => undefined);
  await slowStep(page, "Instagram share flow completed.");
}

async function postLoadedInstagramPost(
  page: Page,
  post: LoadedInstagramPost,
): Promise<void> {
  console.log(`Posting ${post.payload.postName} from ${post.folderPath}`);
  await openComposer(page);
  await uploadImage(page, post.imagePath);
  await advanceToCaptionScreen(page);
  await fillCaption(page, post.payload.caption);
  await sharePost(page);
}

export async function verifyInstagramLogin(
  options: InstagramTestOptions = {},
): Promise<void> {
  const credentials = getCredentials(options);
  const { browser, page } = await createInstagramSession(
    options.headless ?? false,
  );

  try {
    await loginToInstagram(page, credentials.username, credentials.password);
    console.log("Instagram login succeeded.");
  } finally {
    await browser.close();
  }
}

export async function testInstagramPosting(
  options: InstagramTestOptions = {},
): Promise<void> {
  const credentials = getCredentials(options);
  const postJsonPath = options.postJsonPath ?? findLatestInstagramPostJson();
  const post = readPost(postJsonPath);
  const { browser, page } = await createInstagramSession(
    options.headless ?? false,
  );

  try {
    await loginToInstagram(page, credentials.username, credentials.password);
    console.log(
      `Instagram login succeeded. Testing post with ${post.jsonPath}`,
    );

    if (!options.loginOnly) {
      await postLoadedInstagramPost(page, post);
      console.log("Instagram test post flow completed.");
    }

    const pauseMs = options.pauseMs ?? 0;
    if (pauseMs > 0) {
      console.log(
        `Pausing for ${pauseMs}ms before closing Instagram test browser.`,
      );
      await page.waitForTimeout(pauseMs);
    }
  } finally {
    // FIX: wait before closing so the browser doesn't vanish mid-submission.
    console.log(
      `Waiting ${BROWSER_CLOSE_SETTLE_MS}ms before closing browser...`,
    );
    await page.waitForTimeout(BROWSER_CLOSE_SETTLE_MS);
    await browser.close();
  }
}

export async function postInstagramFolders(
  options: InstagramPosterOptions,
): Promise<void> {
  const credentials = getCredentials(options);
  const posts = options.postJsonPaths.map(readPost);
  const { browser, page } = await createInstagramSession(
    options.headless ?? false,
  );

  try {
    await loginToInstagram(page, credentials.username, credentials.password);

    for (const post of posts) {
      await postLoadedInstagramPost(page, post);
    }
  } finally {
    // FIX: same settle delay before closing when posting for real.
    console.log(
      `Waiting ${BROWSER_CLOSE_SETTLE_MS}ms before closing browser...`,
    );
    await page.waitForTimeout(BROWSER_CLOSE_SETTLE_MS);
    await browser.close();
  }
}
