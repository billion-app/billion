import { chromium, type Browser, type Page } from 'playwright';
import { GeminiClient } from './gemini-client';
import { ScreenshotUtils } from './screenshot-utils';
import * as path from 'path';
import * as fs from 'fs';

export interface AgentOptions {
  headless?: boolean;
  screenshotsDir?: string;
  geminiApiKey?: string;
  baseURL?: string;
}

export interface ScreenshotResult {
  name: string;
  path: string;
  metadata: {
    title?: string;
    description?: string;
    type?: string;
    url?: string;
    timestamp: string;
  };
  caption?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  isAIGenerated?: boolean;
  thumbnailUrl?: string;
  imageUri?: string;
}

export class SocialMediaAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private geminiClient: GeminiClient | null = null;
  private screenshotUtils: ScreenshotUtils;
  private options: Required<AgentOptions>;
  private screenshotsDir: string;

  constructor(options: AgentOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      screenshotsDir: options.screenshotsDir ?? 'screenshots',
      geminiApiKey: options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? '',
      baseURL: options.baseURL ?? 'http://localhost:8081',
    };
    this.screenshotsDir = path.resolve(process.cwd(), this.options.screenshotsDir);
    this.screenshotUtils = new ScreenshotUtils(this.screenshotsDir);

    if (this.options.geminiApiKey) {
      this.geminiClient = new GeminiClient(this.options.geminiApiKey);
    }
  }

  async initialize(): Promise<void> {
    console.log('Initializing social media agent...');

    // Create screenshots directory
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }

    // Launch browser with mobile viewport
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: ['--disable-dev-shm-usage'],
    });

    const context = await this.browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
      baseURL: this.options.baseURL,
    });

    this.page = await context.newPage();
    console.log('Agent initialized with mobile viewport (390x844, dark mode)');
  }

  async navigateTo(screen: 'browse' | 'feed' | 'article-detail', articleId?: string): Promise<void> {
    if (!this.page) throw new Error('Agent not initialized. Call initialize() first.');

    let url = '/';
    switch (screen) {
      case 'browse':
        url = '/';
        break;
      case 'feed':
        url = '/feed';
        break;
      case 'article-detail':
        if (!articleId) throw new Error('articleId required for article-detail screen');
        url = `/article-detail?id=${articleId}`;
        break;
    }

    console.log(`Navigating to ${url}...`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(`**${url}`);
    await this.waitForScreenReady(screen);
  }

  async extractContentFromBrowse(maxItems: number = 5): Promise<ContentItem[]> {
    if (!this.page) throw new Error('Agent not initialized.');

    await this.waitForScreenReady('browse');

    const cards = this.page.getByTestId('content-card');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} browse cards via testID`);
    const contentItems: ContentItem[] = [];

    for (let i = 0; i < Math.min(cardCount, maxItems); i++) {
      const card = cards.nth(i);
      const badgeText = await card.getByTestId('content-card-badge').textContent().then(t => t?.trim() ?? '');
      const title = await card.getByTestId('content-card-title').textContent().then(t => t?.trim() ?? '');
      const description = await card.getByTestId('content-card-description').textContent().then(t => t?.trim() ?? '').catch(() => '');
      const id = await this.extractArticleIdFromCard('[data-testid="content-card"]', i).catch(() => `card-${i}`);

      contentItems.push({
        id,
        title,
        description,
        type: this.mapTypeBadgeToContentType(badgeText),
      });
    }

    return contentItems;
  }

  async extractContentFromFeed(maxItems: number = 3): Promise<ContentItem[]> {
    if (!this.page) throw new Error('Agent not initialized.');

    await this.waitForScreenReady('feed');

    const cards = this.page.getByTestId('feed-card');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} feed cards via testID`);
    const contentItems: ContentItem[] = [];

    for (let i = 0; i < Math.min(cardCount, maxItems); i++) {
      const card = cards.nth(i);
      const fullText = await card.textContent().then(t => t?.trim()) || '';

      const badgeText = await card.getByTestId('feed-badge').textContent().then(t => t?.trim() ?? '').catch(() => '');
      let type = this.mapTypeBadgeToContentType(badgeText);
      let title = fullText;
      if (badgeText && fullText.startsWith(badgeText)) {
        title = fullText.substring(badgeText.length).trim();
      }

      // Try to find description - look for text after title
      let description = '';
      try {
        // Get all text nodes
        const childTexts = await card.evaluate(el => {
          const walk = (node: Element): string[] => {
            const texts: string[] = [];
            const text = node.textContent?.trim();
            if (text && text.length > 0) {
              const hasChildText = Array.from(node.children).some(child =>
                child.textContent?.trim() && child.textContent.trim().length > 0
              );
              if (!hasChildText && !text.includes('ORDER') && !text.includes('Read Full Article')) {
                texts.push(text);
              }
            }
            for (const child of Array.from(node.children)) {
              texts.push(...walk(child));
            }
            return texts;
          };
          return walk(el);
        });

        // Find description text
        for (const text of childTexts) {
          if (text.length > 10 && text !== title) {
            description = text.substring(0, 200);
            break;
          }
        }
      } catch (e) {
        console.log('Error extracting feed description:', e);
      }

      const id = await this.extractArticleIdFromCard('[data-testid="feed-card"]', i).catch(() => `feed-${i}`);

      contentItems.push({
        id,
        title,
        description,
        type,
      });
    }

    return contentItems;
  }

  async extractArticleDetail(): Promise<{
    title: string;
    description: string;
    type: string;
    articleContent: string;
    originalContent: string;
    url?: string;
  }> {
    if (!this.page) throw new Error('Agent not initialized.');

    await this.waitForScreenReady('article-detail');

    // Find badge to determine type
    let type = 'general';
    const badgeTexts = ['BILL', 'CASE', 'ORDER'];
    for (const text of badgeTexts) {
      const badgeElements = await this.page.getByText(text).all();
      if (badgeElements.length > 0) {
        type = this.mapTypeBadgeToContentType(text);
        break;
      }
    }

    // Find title - look for largest text element that's not the badge
    let title = '';
    try {
      const textElements = await this.page.evaluate(() => {
        const blockedBadges = ['BILL', 'CASE', 'ORDER'];
        const all = Array.from(document.querySelectorAll('div[class], h1[class], h2[class], span[class]'));
        return all.map(el => ({
          element: el,
          tag: el.tagName,
          className: el.getAttribute('class') || '',
          text: el.textContent?.trim() || '',
          fontSize: parseFloat(window.getComputedStyle(el).fontSize),
          textLength: el.textContent?.length || 0
        })).filter(el => el.text.length > 10 && !blockedBadges.some(badge => el.text.includes(badge)));
      });

      // Sort by font size and text length
      textElements.sort((a, b) => {
        if (Math.abs(a.fontSize - b.fontSize) > 2) {
          return b.fontSize - a.fontSize; // Larger font first
        }
        return b.textLength - a.textLength; // Longer text first
      });

      if (textElements.length > 0) {
        title = textElements[0].text.substring(0, 200);
      }
    } catch (e) {
      console.log('Error extracting title:', e);
    }

    // Find description - look for medium-length text
    let description = '';
    try {
      const textElements = await this.page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('div[class], p[class], span[class]'));
        return all.map(el => ({
          text: el.textContent?.trim() || '',
          length: el.textContent?.length || 0
        })).filter(el => el.text.length > 30 && el.text.length < 300);
      });

      if (textElements.length > 0) {
        // Pick first that's not the title
        for (const el of textElements) {
          if (el.text !== title) {
            description = el.text;
            break;
          }
        }
      }
    } catch (e) {
      console.log('Error extracting description:', e);
    }

    // Extract article content - look for tab switching
    let articleContent = '';
    let originalContent = '';
    try {
      // Try to find Article and Original tabs
      const articleTab = this.page.getByRole('button', { name: 'Article' }).first();
      const originalTab = this.page.getByRole('button', { name: 'Original' }).first();

      const hasArticleTab = await articleTab.count().then(c => c > 0);
      const hasOriginalTab = await originalTab.count().then(c => c > 0);

      if (hasArticleTab) {
        await articleTab.click();
        await this.page.waitForTimeout(500);
        // Find content area with significant text
        const content = await this.page.evaluate(() => {
          const divs = Array.from(document.querySelectorAll('div[class]'));
          const contentDivs = divs.filter(d => {
            const text = d.textContent?.trim() || '';
            return text.length > 100;
          });
          return contentDivs.map(d => d.textContent?.trim() || '').join('\n\n');
        });
        articleContent = content;
      }

      if (hasOriginalTab) {
        await originalTab.click();
        await this.page.waitForTimeout(500);
        const content = await this.page.evaluate(() => {
          const divs = Array.from(document.querySelectorAll('div[class]'));
          const contentDivs = divs.filter(d => {
            const text = d.textContent?.trim() || '';
            return text.length > 100;
          });
          return contentDivs.map(d => d.textContent?.trim() || '').join('\n\n');
        });
        originalContent = content;
      }

      // If no tabs found, just get all content
      if (!hasArticleTab && !hasOriginalTab) {
        const allContent = await this.page.evaluate(() => {
          const divs = Array.from(document.querySelectorAll('div[class]'));
          return divs.map(d => d.textContent?.trim() || '').filter(t => t.length > 10).join('\n\n');
        });
        articleContent = allContent;
      }
    } catch (e) {
      console.log('Error extracting content:', e);
    }

    // Extract URL if present
    let url: string | undefined;
    try {
      const viewButton = this.page.locator('button:has-text("View on Original Site"), a:has-text("View on Original Site")').first();
      const buttonCount = await viewButton.count();
      if (buttonCount > 0) {
        url = await viewButton.getAttribute('href') || undefined;
      }
    } catch (e) {
      console.log('Error extracting URL:', e);
    }

    return {
      title,
      description,
      type,
      articleContent,
      originalContent,
      url,
    };
  }

  async extractArticleIdFromCard(cardSelector: string, cardIndex: number = 0): Promise<string> {
    if (!this.page) throw new Error('Agent not initialized.');

    // Find the card
    const card = this.page.locator(cardSelector).nth(cardIndex);
    if (await card.count() === 0) {
      throw new Error(`No card found with selector ${cardSelector} at index ${cardIndex}`);
    }

    await Promise.all([
      this.page.waitForURL(/\/article-detail\?id=/),
      card.click(),
    ]);

    // Extract ID from URL
    const url = this.page.url();
    const idMatch = url.match(/id=([^&]+)/);
    if (!idMatch) {
      throw new Error('Could not extract article ID from URL after click');
    }
    const articleId = idMatch[1];

    // Go back to previous page
    await this.page.goBack();
    await this.waitForScreenReady(cardSelector.includes('feed-card') ? 'feed' : 'browse');

    return articleId;
  }

  private async waitForScreenReady(screen: 'browse' | 'feed' | 'article-detail'): Promise<void> {
    if (!this.page) throw new Error('Agent not initialized.');

    await this.waitForNetworkToSettle();

    switch (screen) {
      case 'browse':
        await this.page.locator('[data-testid="content-card"]').first().waitFor({ state: 'visible', timeout: 15000 });
        break;
      case 'feed':
        await this.page.locator('[data-testid="feed-card"]').first().waitFor({ state: 'visible', timeout: 15000 });
        break;
      case 'article-detail':
        await this.page.getByText('Article').first().waitFor({ state: 'visible', timeout: 15000 });
        await this.page.getByText('Original').first().waitFor({ state: 'visible', timeout: 15000 });
        break;
    }

    await this.page.waitForTimeout(500);
  }

  private async waitForNetworkToSettle(): Promise<void> {
    if (!this.page) throw new Error('Agent not initialized.');

    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // React Query and the Expo dev client can keep network activity alive.
      await this.page.waitForLoadState('load', { timeout: 5000 }).catch(() => undefined);
    }
  }

  async takeScreenshot(selector: string, name: string): Promise<ScreenshotResult> {
    if (!this.page) throw new Error('Agent not initialized.');

    const screenshotPath = await this.screenshotUtils.captureElement(
      this.page,
      selector,
      name
    );

    const result: ScreenshotResult = {
      name,
      path: screenshotPath,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    return result;
  }

  async takeFullPageScreenshot(name: string): Promise<ScreenshotResult> {
    if (!this.page) throw new Error('Agent not initialized.');

    const screenshotPath = await this.screenshotUtils.captureFullPage(
      this.page,
      name
    );

    const result: ScreenshotResult = {
      name,
      path: screenshotPath,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    return result;
  }

  async generateSocialPost(content: ContentItem, screenshotPath?: string): Promise<string> {
    if (!this.geminiClient) {
      console.warn('Gemini API key not provided. Returning basic caption.');
      return this.generateBasicCaption(content);
    }

    try {
      let imageAnalysis = '';
      if (screenshotPath) {
        imageAnalysis = await this.geminiClient.analyzeImage(screenshotPath);
      }

      const caption = await this.geminiClient.generateCaption({
        title: content.title,
        description: content.description || '',
        contentType: content.type,
        imageAnalysis,
      });

      return caption;
    } catch (error) {
      console.error('Error generating social post with Gemini:', error);
      return this.generateBasicCaption(content);
    }
  }

  private generateBasicCaption(content: ContentItem): string {
    const hashtags = this.getHashtagsForType(content.type);
    return `${content.title}\n\n${content.description || ''}\n\n${hashtags.join(' ')}`;
  }

  private getHashtagsForType(type: string): string[] {
    const hashtagMap: Record<string, string[]> = {
      bill: ['#Legislation', '#Government', '#Politics', '#Bill'],
      court_case: ['#CourtCase', '#Justice', '#Legal', '#Law'],
      government_content: ['#Government', '#Policy', '#Order', '#ExecutiveAction'],
      general: ['#News', '#CurrentEvents', '#Politics'],
    };

    return hashtagMap[type] || ['#News', '#BillionApp'];
  }

  private mapTypeBadgeToContentType(badgeText: string): string {
    const badgeLower = badgeText.toLowerCase();
    if (badgeLower.includes('bill')) return 'bill';
    if (badgeLower.includes('case')) return 'court_case';
    if (badgeLower.includes('order')) return 'government_content';
    return 'general';
  }

  async saveMetadata(results: ScreenshotResult[], outputPath?: string): Promise<void> {
    const metadataPath = outputPath || path.join(this.screenshotsDir, 'metadata.json');

    const existingData = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      : { screenshots: [] };

    existingData.screenshots.push(...results);
    existingData.updatedAt = new Date().toISOString();

    fs.writeFileSync(metadataPath, JSON.stringify(existingData, null, 2));
    console.log(`Metadata saved to ${metadataPath}`);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    console.log('Agent closed.');
  }
}
