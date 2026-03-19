 Plan: Social Media Agent System for Billion News App

 Context

 The user wants to create an agent system that operates through Playwright to
 navigate the Billion news app "like a human" and take screenshots of headlines
  and article summaries for social media posts. The agent should create
 previews of the app content so people can get information without using the
 app directly. The system should use the Gemini API for LLM operations to
 analyze and caption screenshots.

 The Billion app is a T3 Turbo monorepo with:
 - Expo (React Native) mobile app at apps/expo/src/app/ - Runs in web mode on
 localhost:8081 with complete news UI
 - Next.js web app at apps/nextjs/src/app/ (currently basic template, not
 showing news content) - Not used for agent
 - Shared API in packages/api/ serving content to both frontends
 - Social-media-agent directory for Playwright automation

 Clarification from user: Agent should target the Expo mobile app running in
 web mode (not Next.js). The app runs on localhost:8081 as shown in
 openLocalhost.ts.

 Key findings from exploration:
 1. Mobile app has complete news browsing: Browse screen (index.tsx), Feed
 screen (feed.tsx), Article detail (article-detail.tsx)
 2. Content structure: Articles have titles, descriptions, AI-generated
 content, and images (either thumbnail URLs or AI-generated data URIs)
 3. No existing screenshot utilities: Need to implement Playwright screenshot
 capture
 4. Gemini API key available in social-media-agent .env but no integration
 5. Playwright minimally configured: Needs base URL and web server setup
 6. No test IDs: Need to use text content, CSS classes, and placeholder text
 for selectors
 7. Mobile viewport: Should simulate mobile device (390x844) with dark mode
 enabled

 Implementation Approach

 Phase 1: Enhance Playwright Configuration

 File: /Users/lcai/Developer/billion/social-media-agent/playwright.config.ts

 1. Configure web server for local app:
   - Set baseURL: 'http://localhost:8081' (Expo mobile app runs on port 8081 in
  web mode)
   - Add webServer configuration to start Expo dev server (optional - assume
 app already running)
   - Add retries and timeout settings for flaky connections
   - Configure mobile viewport (390x844) and dark mode to match
 openLocalhost.ts
 2. Add environment variables:
   - Load .env file for GEMINI_API_KEY (already exists in social-media-agent
 directory)
   - Add configuration for screenshot output directory (screenshots/)
 3. Update dependencies in package.json:
   - Add @google/generative-ai for Gemini API
   - Add dotenv for environment loading
   - Add sharp for image processing (optional, for compositing screenshots)
   - Add commander or yargs for CLI argument parsing

 Phase 2: Create Core Agent System

 File: /Users/lcai/Developer/billion/social-media-agent/src/agent.ts

 1. Agent class with methods:
   - initialize(): Launch browser with mobile viewport (390x844), dark mode,
 emulate touch
   - navigateTo(screen): Go to Browse (/), Feed (/feed), or Article detail
 (/article-detail?id=...)
   - takeScreenshot(selector, name): Capture specific elements or full page
   - extractTextContent(): Parse text from page using Playwright selectors (not
  just screenshots)
   - generateSocialPost(): Use Gemini API to create caption from extracted
 content
   - saveOutput(): Save screenshots and metadata to screenshots/ directory
 2. Screen navigation strategies:
   - Browse screen: Capture content cards with headlines, descriptions, type
 badges
   - Feed screen: Capture vertical feed items with article previews, engagement
  metrics
   - Article detail: Capture both "Article" and "Original" tab content, toggle
 between them
 3. Selector strategy (no test IDs available - use existing UI patterns):
   - Use text content: page.getByText('Browse'), page.getByText('BILL') (type
 badges)
   - Use CSS classes from styles.ts: page.locator('.card'),
 page.locator('.cardTitle')
   - Use placeholder text: page.getByPlaceholder('Search bills, cases,
 orders…')
   - Use role-based: page.getByRole('button', { name: 'Read More' })
   - Use attribute selectors: [href^="/article-detail"] for article links

 Phase 3: Implement Screenshot Pipeline

 File: /Users/lcai/Developer/billion/social-media-agent/src/screenshot-utils.ts

 1. Element screenshot function:
   - Use element.screenshot() for specific components
   - Handle data URI images in the app (AI-generated imageUri fields)
   - Add visual indicators (borders, highlights) for social media
 2. Multi-element capture:
   - Capture headline + summary + image as composite
   - Stitch multiple screenshots for long articles
   - Add app branding/watermark
 3. Output management:
   - Save to screenshots/ directory with timestamped names
   - Generate metadata JSON with content and Gemini analysis

 Phase 4: Gemini API Integration

 File: /Users/lcai/Developer/billion/social-media-agent/src/gemini-client.ts

 1. Initialize Gemini with API key from environment
 2. Content analysis functions:
   - analyzeScreenshot(imageBuffer): Describe visual content
   - generateCaption(title, description, screenshotAnalysis): Create social
 media caption
   - extractKeyPoints(fullArticle): Identify shareable insights
   - generateHashtags(contentType, topics): Relevant hashtags
 3. Prompt engineering for news content:
   - Tone: Informative but engaging
   - Length: Optimized for different platforms (Twitter, Instagram, LinkedIn)
   - Include call-to-action to download app

 Phase 5: Create Test Suite

 File:
 /Users/lcai/Developer/billion/social-media-agent/tests/social-agent.spec.ts

 1. End-to-end tests:
   - Agent initialization and browser launch
   - Navigation to each screen
   - Screenshot capture of key elements
   - Gemini API integration (mock in tests)
 2. Test data:
   - Use mock content from API or seeded database
   - Test with different content types (bills, court cases, government content)
 3. CI/CD integration:
   - Run tests in GitHub Actions
   - Store screenshots as artifacts

 Phase 6: CLI Interface

 File: /Users/lcai/Developer/billion/social-media-agent/src/cli.ts

 1. Command-line interface:
   - pnpm agent:run --screen=browse --count=5: Capture N items from Browse
 screen
   - pnpm agent:run --article-id=123: Capture specific article detail
   - pnpm agent:run --feed --scrolls=3: Scroll through feed and capture items
   - pnpm agent:run --all: Capture content from all screens
 2. Output options:
   - Save screenshots to screenshots/ directory (default) or custom path
   - Generate JSON metadata with extracted content and Gemini analysis
   - Content generation only: No auto-posting to social media (manual posting
 required)

 Critical Files to Modify/Create

 New Files:

 1. /Users/lcai/Developer/billion/social-media-agent/src/agent.ts - Core agent
 class
 2. /Users/lcai/Developer/billion/social-media-agent/src/screenshot-utils.ts -
 Screenshot utilities
 3. /Users/lcai/Developer/billion/social-media-agent/src/gemini-client.ts -
 Gemini API client
 4. /Users/lcai/Developer/billion/social-media-agent/src/cli.ts - CLI interface
 5. /Users/lcai/Developer/billion/social-media-agent/tests/social-agent.spec.ts
  - Test suite

 Modified Files:

 1. /Users/lcai/Developer/billion/social-media-agent/playwright.config.ts -
 Enhanced configuration
 2. /Users/lcai/Developer/billion/social-media-agent/package.json - Add
 dependencies
 3. /Users/lcai/Developer/billion/social-media-agent/.gitignore - Add
 screenshot outputs

 Existing Files to Reference:

 1. /Users/lcai/Developer/billion/apps/expo/src/app/(tabs)/index.tsx - Browse
 screen selectors
 2. /Users/lcai/Developer/billion/apps/expo/src/app/(tabs)/feed.tsx - Feed
 screen selectors
 3. /Users/lcai/Developer/billion/apps/expo/src/app/article-detail.tsx -
 Article detail selectors
 4. /Users/lcai/Developer/billion/apps/expo/src/styles.ts - CSS class names
 5. /Users/lcai/Developer/billion/social-media-agent/openLocalhost.ts - Mobile
 viewport config

 Dependencies to Add

 1. Gemini API: @google/generative-ai
 2. Environment loading: dotenv
 3. Image processing (optional): sharp
 4. CLI argument parsing: commander or yargs
 5. TypeScript types for Gemini responses

 Verification

 End-to-End Test Plan:

 1. Start the app: Run pnpm dev in root, ensure Expo app runs on localhost:8081
  in web mode
 2. Ensure database populated: Content should exist (bills, government content,
  court cases)
 3. Run agent: Execute pnpm agent:run --screen=browse --count=3 from
 social-media-agent directory
 4. Verify outputs:
   - Screenshots saved to screenshots/ directory with timestamped names
   - JSON metadata with extracted content (title, description, type, etc.)
   - Gemini-generated captions (if GEMINI_API_KEY is set in .env)
 5. Test different screens:
   - Browse screen: Capture 3 content cards with headlines and descriptions
   - Feed screen: Capture 2 scroll items with article previews
   - Article detail: Capture both "Article" and "Original" tabs for a specific
 article
 6. Live app requirement: Tests require running app; consider adding mock mode
 for CI (future)

 Success Criteria:

 - Agent successfully launches browser and navigates to app
 - Screenshots capture relevant content (headlines, summaries, images)
 - Gemini API generates coherent captions from screenshot content
 - CLI provides useful options for different use cases
 - Tests pass in CI environment

 Considerations and Trade-offs

 1. Live app dependency: Agent requires Expo app running on localhost:8081 with
  populated database
 2. Selector stability: CSS classes may change; consider adding test IDs to app
  for robustness
 3. API costs: Gemini API usage; implement caching and rate limiting
 4. Performance: Screenshot capture and processing time; optimize for speed
 5. Error handling: App may be in different states; implement retries and
 fallbacks
 6. Mobile viewport: Targets mobile simulation (390x844); ensure responsive UI
 works correctly

 Future Enhancements

 1. Direct social media posting: Integrate with Twitter, Instagram, LinkedIn
 APIs
 2. Scheduling: Regular automated posting based on new content
 3. A/B testing: Different caption styles and visual treatments
 4. Analytics: Track engagement from agent-generated posts
 5. Content curation: Use Gemini to select most shareable content

 This plan creates a comprehensive social media agent system that navigates the
  Billion app, captures compelling visuals, and generates engaging social media
  content using AI analysis.