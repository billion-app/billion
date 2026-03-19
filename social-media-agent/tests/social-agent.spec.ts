import { test, expect } from '@playwright/test';
import { SocialMediaAgent } from '../src/agent';

test.describe('Social Media Agent', () => {
  let agent: SocialMediaAgent;

  test.beforeEach(async () => {
    agent = new SocialMediaAgent({
      headless: true,
      screenshotsDir: 'test-screenshots',
      geminiApiKey: '', // Ensure no Gemini for tests
    });
    await agent.initialize();
  });

  test.afterEach(async () => {
    await agent.close();
  });

  test('should initialize browser with mobile viewport', async () => {
    // Agent is initialized in beforeEach
    expect(agent).toBeDefined();
  });

  test('should navigate to browse screen', async () => {
    await agent.navigateTo('browse');
    // If navigation succeeds without error, test passes
  });

  test('should extract content from browse screen', async () => {
    await agent.navigateTo('browse');
    const contentItems = await agent.extractContentFromBrowse(2);

    expect(Array.isArray(contentItems)).toBe(true);
    expect(contentItems.length).toBeGreaterThan(0);

    if (contentItems.length > 0) {
      const item = contentItems[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('type');
    }
  });

  test('should take screenshot of browse screen', async () => {
    await agent.navigateTo('browse');
    const screenshot = await agent.takeFullPageScreenshot('test-browse-fullpage');

    expect(screenshot).toHaveProperty('path');
    expect(screenshot).toHaveProperty('metadata');
    expect(screenshot.metadata.timestamp).toBeDefined();
  });

  test('should navigate to feed screen', async () => {
    await agent.navigateTo('feed');
    // If navigation succeeds without error, test passes
  });

  test('should navigate to article-detail with valid ID', async () => {
    // Navigate to browse and extract a real article ID by clicking first card
    await agent.navigateTo('browse');
    // Wait for cards to load
    // Note: agent.page is private, but extractArticleIdFromCard handles waiting

    // Use the new method to get real article ID
    const articleId = await (agent as any).extractArticleIdFromCard('[data-testid="content-card"]', 0);
    console.log(`Extracted article ID: ${articleId}`);

    // Navigate to article-detail with the real ID
    await agent.navigateTo('article-detail', articleId);
    // If navigation succeeds without error, test passes
  });

  test('should generate basic caption without Gemini', async () => {
    const contentItem = {
      id: 'test-1',
      title: 'Test Legislation Title',
      description: 'This is a test description of a bill.',
      type: 'bill',
    };

    const caption = await agent.generateSocialPost(contentItem);

    expect(typeof caption).toBe('string');
    expect(caption.length).toBeGreaterThan(0);
    expect(caption).toContain(contentItem.title);
  });

  test('should save metadata', async () => {
    const testResults = [
      {
        name: 'test-1',
        path: '/tmp/test1.png',
        metadata: {
          timestamp: new Date().toISOString(),
          title: 'Test Title',
        },
      },
    ];

    await agent.saveMetadata(testResults);
    // If no error thrown, test passes
  });
});
