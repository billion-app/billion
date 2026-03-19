#!/usr/bin/env node
import { Command } from 'commander';
import { SocialMediaAgent } from './agent';
import * as path from 'path';
import 'dotenv/config';

const program = new Command();

program
  .name('social-agent')
  .description('Social media agent for Billion news app')
  .version('1.0.0');

program
  .command('run')
  .description('Run the social media agent')
  .option('--screen <type>', 'Screen to capture: browse, feed, article-detail', 'browse')
  .option('--count <number>', 'Number of items to capture', '3')
  .option('--article-id <id>', 'Article ID for article-detail screen')
  .option('--output <dir>', 'Output directory for screenshots', 'screenshots')
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Show browser window')
  .option('--no-gemini', 'Skip Gemini caption generation')
  .action(async (options) => {
    console.log('Starting social media agent...');
    console.log('Options:', options);

    // Validate screen type
    const validScreens = ['browse', 'feed', 'article-detail'];
    if (!validScreens.includes(options.screen)) {
      console.error(`Invalid screen type: ${options.screen}. Must be one of: ${validScreens.join(', ')}`);
      process.exit(1);
    }

    // Validate article ID for article-detail screen
    if (options.screen === 'article-detail' && !options.articleId) {
      console.error('Article ID is required for article-detail screen. Use --article-id <id>');
      process.exit(1);
    }

    const agent = new SocialMediaAgent({
      headless: options.headless,
      screenshotsDir: options.output,
      geminiApiKey: options.gemini ? process.env.GEMINI_API_KEY : undefined,
      baseURL: process.env.BASE_URL || 'http://localhost:8081',
    });

    try {
      await agent.initialize();

      // Navigate to target screen
      if (options.screen === 'article-detail') {
        await agent.navigateTo('article-detail', options.articleId);
      } else {
        await agent.navigateTo(options.screen);
      }

      const screenshotResults = [];

      if (options.screen === 'browse') {
        // Extract content from browse screen
        const contentItems = await agent.extractContentFromBrowse(parseInt(options.count));
        console.log(`Found ${contentItems.length} content items`);

        // Take screenshots of each content card
        for (let i = 0; i < contentItems.length; i++) {
          const item = contentItems[i];
          console.log(`Processing item ${i + 1}: ${item.title}`);

          const screenshot = await agent.takeScreenshot(
            `[data-testid="content-card"] >> nth=${i}`,
            `browse-item-${i + 1}`
          );

          // Add metadata
          screenshot.metadata.title = item.title;
          screenshot.metadata.description = item.description;
          screenshot.metadata.type = item.type;
          screenshot.metadata.url = `/article-detail?id=${item.id}`;

          // Generate caption if Gemini is enabled
          if (options.gemini) {
            screenshot.caption = await agent.generateSocialPost(item, screenshot.path);
            console.log(`Generated caption: ${screenshot.caption.substring(0, 100)}...`);
          }

          screenshotResults.push(screenshot);
        }

      } else if (options.screen === 'feed') {
        // Extract content from feed
        const contentItems = await agent.extractContentFromFeed(parseInt(options.count));
        console.log(`Found ${contentItems.length} feed items`);

        // Take full page screenshots for each feed item (since feed is vertical paging)
        for (let i = 0; i < contentItems.length; i++) {
          const item = contentItems[i];
          console.log(`Processing feed item ${i + 1}: ${item.title}`);

          const screenshot = await agent.takeFullPageScreenshot(`feed-item-${i + 1}`);
          screenshot.metadata.title = item.title;
          screenshot.metadata.description = item.description;
          screenshot.metadata.type = item.type;

          if (options.gemini) {
            screenshot.caption = await agent.generateSocialPost(item, screenshot.path);
            console.log(`Generated caption: ${screenshot.caption.substring(0, 100)}...`);
          }

          screenshotResults.push(screenshot);

          // Scroll to next item if not last
          if (i < contentItems.length - 1) {
            console.log('Scrolling to next feed item...');
            // Implementation depends on feed scrolling logic
          }
        }

      } else if (options.screen === 'article-detail') {
        // Extract article detail
        const articleDetail = await agent.extractArticleDetail();
        console.log(`Processing article: ${articleDetail.title}`);

        // Take screenshot of article header
        const headerScreenshot = await agent.takeScreenshot(
          '.articleTitle',
          'article-header'
        );
        headerScreenshot.metadata.title = articleDetail.title;
        headerScreenshot.metadata.description = articleDetail.description;
        headerScreenshot.metadata.type = articleDetail.type;
        headerScreenshot.metadata.url = articleDetail.url;

        // Take screenshot of article content
        const contentScreenshot = await agent.takeScreenshot(
          '.content',
          'article-content'
        );

        // Take screenshot of original content (switch tab)
        // Note: This would require tab switching in the agent

        if (options.gemini) {
          // Create a content item for caption generation
          const contentItem = {
            id: options.articleId,
            title: articleDetail.title,
            description: articleDetail.description,
            type: articleDetail.type,
          };
          headerScreenshot.caption = await agent.generateSocialPost(contentItem, headerScreenshot.path);
          console.log(`Generated caption: ${headerScreenshot.caption.substring(0, 100)}...`);
        }

        screenshotResults.push(headerScreenshot, contentScreenshot);
      }

      // Save metadata
      await agent.saveMetadata(screenshotResults);

      console.log('\n=== Summary ===');
      console.log(`Screenshots saved: ${screenshotResults.length}`);
      console.log(`Output directory: ${path.resolve(options.output)}`);

      // Print captions if generated
      if (options.gemini) {
        console.log('\n=== Generated Captions ===');
        screenshotResults.forEach((result, i) => {
          if (result.caption) {
            console.log(`\n${i + 1}. ${result.name}:`);
            console.log(result.caption);
            console.log('---');
          }
        });
      }

    } catch (error) {
      console.error('Error running agent:', error);
      process.exit(1);
    } finally {
      await agent.close();
    }
  });

program
  .command('test')
  .description('Test the agent with a simple navigation')
  .action(async () => {
    console.log('Testing agent...');
    const agent = new SocialMediaAgent({
      headless: true,
      baseURL: process.env.BASE_URL || 'http://localhost:8081',
    });

    try {
      await agent.initialize();
      await agent.navigateTo('browse');
      console.log('Successfully navigated to browse screen');

      // Take a full page screenshot
      const screenshot = await agent.takeFullPageScreenshot('test-browse');
      console.log(`Test screenshot saved: ${screenshot.path}`);

      // Extract some content
      const contentItems = await agent.extractContentFromBrowse(2);
      console.log(`Extracted ${contentItems.length} content items`);

      if (contentItems.length > 0) {
        console.log('First item:', contentItems[0]);
      }

    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      await agent.close();
    }
  });

program
  .command('list-screens')
  .description('List available screens in the app')
  .action(() => {
    console.log('Available screens:');
    console.log('- browse: Browse content cards with filtering');
    console.log('- feed: Vertical video feed with article previews');
    console.log('- article-detail: Article detail with Article/Original tabs');
    console.log('\nUse --screen <name> to target a specific screen.');
  });

program.parse();
