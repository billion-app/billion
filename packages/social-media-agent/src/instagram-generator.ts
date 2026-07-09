import * as fs from "fs";
import * as path from "path";

import type { ContentItem } from "./agent";
import { SocialMediaAgent } from "./agent";
import { defaultInstagramPostsDir, defaultScreenshotsDir } from "./paths";

type Category = "browse" | "feed" | "article" | "all";

interface GeneratorOptions {
  category: Category;
  count: number;
  articleId?: string;
  headless: boolean;
}

interface SavedPost {
  category: Exclude<Category, "all">;
  folderPath: string;
  jsonPath: string;
  imagePath: string;
  title: string;
}

interface PostPayload {
  postName: string;
  caption: string;
  description: string;
  imageFile: string;
  category: Exclude<Category, "all">;
  sourceUrl?: string;
  generatedAt: string;
}

const ROOT_DIR = defaultInstagramPostsDir;

function sanitizeFileName(input: string): string {
  return (
    input
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "untitled-post"
  );
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyImage(sourcePath: string, targetPath: string): void {
  fs.copyFileSync(sourcePath, targetPath);
}

async function savePost(
  category: Exclude<Category, "all">,
  title: string,
  description: string,
  caption: string,
  screenshotPath: string,
  sourceUrl?: string,
): Promise<SavedPost> {
  ensureDir(ROOT_DIR);

  const folderName = sanitizeFileName(title);
  const folderPath = path.join(ROOT_DIR, folderName);
  ensureDir(folderPath);

  const imageFileName = path.extname(screenshotPath) || ".png";
  const imagePath = path.join(folderPath, `post${imageFileName}`);
  copyImage(screenshotPath, imagePath);

  const payload: PostPayload = {
    postName: title,
    caption,
    description,
    imageFile: path.basename(imagePath),
    category,
    sourceUrl,
    generatedAt: new Date().toISOString(),
  };

  const jsonPath = path.join(folderPath, "post.json");
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  return {
    category,
    folderPath,
    jsonPath,
    imagePath,
    title,
  };
}

async function captureBrowse(
  agent: SocialMediaAgent,
  count: number,
): Promise<SavedPost[]> {
  await agent.navigateTo("browse");
  await agent.selectBrowseTab("All");
  const items = await agent.extractContentFromBrowse(count);
  const saved: SavedPost[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    await agent.navigateTo("article-detail", item.id);
    const article = await agent.extractArticleDetail();
    const screenshot = await agent.takeViewportScreenshot(
      `browse-item-${i + 1}`,
    );

    const contentItem: ContentItem = {
      id: item.id,
      title: article.title || item.title,
      description: article.description || item.description,
      type: article.type || item.type,
    };

    const caption = await agent.generateSocialPost(
      contentItem,
      screenshot.path,
    );
    saved.push(
      await savePost(
        "browse",
        contentItem.title,
        contentItem.description ?? "",
        caption,
        screenshot.path,
        `/article-detail?id=${item.id}`,
      ),
    );
  }

  return saved;
}

async function captureFeed(
  agent: SocialMediaAgent,
  count: number,
): Promise<SavedPost[]> {
  await agent.navigateTo("feed");
  const items = await agent.extractContentFromFeed(count);
  const saved: SavedPost[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    await agent.scrollFeedTo(i);
    const screenshot = await agent.takeViewportScreenshot(`feed-item-${i + 1}`);
    const caption = await agent.generateSocialPost(item, screenshot.path);
    saved.push(
      await savePost(
        "feed",
        item.title,
        item.description ?? "",
        caption,
        screenshot.path,
        item.id.startsWith("feed-")
          ? undefined
          : `/article-detail?id=${item.id}`,
      ),
    );
  }

  return saved;
}

async function resolveArticleId(
  agent: SocialMediaAgent,
  providedArticleId?: string,
): Promise<string> {
  if (providedArticleId) {
    return providedArticleId;
  }

  await agent.navigateTo("browse");
  const items = await agent.extractContentFromBrowse(1);
  if (items.length === 0) {
    throw new Error("No browse content available to derive an article ID.");
  }

  return items[0]!.id;
}

async function captureArticle(
  agent: SocialMediaAgent,
  articleId?: string,
): Promise<SavedPost[]> {
  const resolvedArticleId = await resolveArticleId(agent, articleId);
  await agent.navigateTo("article-detail", resolvedArticleId);
  const article = await agent.extractArticleDetail();
  const screenshot = await agent.takeViewportScreenshot("article-detail");

  const contentItem: ContentItem = {
    id: resolvedArticleId,
    title: article.title,
    description: article.description,
    type: article.type,
  };

  const caption = await agent.generateSocialPost(contentItem, screenshot.path);
  return [
    await savePost(
      "article",
      article.title,
      article.description,
      caption,
      screenshot.path,
      `/article-detail?id=${resolvedArticleId}`,
    ),
  ];
}

export async function generateInstagramPosts(
  options: GeneratorOptions,
): Promise<SavedPost[]> {
  const agent = new SocialMediaAgent({
    headless: options.headless,
    screenshotsDir: defaultScreenshotsDir,
    geminiApiKey: process.env.GEMINI_API_KEY,
    baseURL: process.env.BASE_URL,
  });

  const savedPosts: SavedPost[] = [];

  try {
    await agent.initialize();

    if (options.category === "browse" || options.category === "all") {
      savedPosts.push(...(await captureBrowse(agent, options.count)));
    }

    if (options.category === "feed" || options.category === "all") {
      savedPosts.push(...(await captureFeed(agent, options.count)));
    }

    if (options.category === "article" || options.category === "all") {
      savedPosts.push(...(await captureArticle(agent, options.articleId)));
    }

    return savedPosts;
  } finally {
    await agent.close();
  }
}
