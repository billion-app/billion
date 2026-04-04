// Retroactive video generator for existing articles
// Generates videos for articles that don't have videos yet

// IMPORTANT: Load env FIRST before any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../../.env') });

// Import utilities AFTER env is loaded
import { generateVideoForContent } from './utils/db/video-operations.js';
import { findArticlesWithoutVideos } from './utils/db/helpers.js';
import { createLogger, printHeader, printKeyValue, printFooter } from './utils/log.js';

const logger = createLogger("retro-video");

interface RetroactiveOptions {
  contentType?: 'bill' | 'government_content' | 'court_case' | 'all';
  limit?: number;
  dryRun?: boolean;
}

interface Stats {
  totalProcessed: number;
  videosGenerated: number;
  errors: number;
}

async function processArticles(
  contentType: 'bill' | 'government_content' | 'court_case',
  options: RetroactiveOptions
): Promise<Stats> {
  const stats: Stats = {
    totalProcessed: 0,
    videosGenerated: 0,
    errors: 0,
  };

  logger.info(`Processing ${contentType} articles...`);

  const articles = await findArticlesWithoutVideos(contentType, options.limit);

  logger.info(`Found ${articles.length} ${contentType} articles without videos`);

  if (options.dryRun) {
    logger.debug(`[DRY RUN] Would generate videos for ${articles.length} articles`);
    return stats;
  }

  for (const article of articles) {
    stats.totalProcessed++;

    try {
      const author = 'sourceWebsite' in article
        ? article.sourceWebsite
        : 'source' in article
          ? article.source
          : 'court';

      await generateVideoForContent(
        contentType,
        article.id,
        article.title,
        article.fullText || '',
        article.contentHash,
        author || 'unknown',
        article.thumbnailUrl || null
      );

      stats.videosGenerated++;
      logger.success(`Generated video for: ${article.title.substring(0, 60)}...`);
    } catch (error) {
      stats.errors++;
      logger.error(`Error generating video for ${article.id}`, error);
    }
  }

  return stats;
}

async function main() {
  logger.info('Starting retroactive video generation...');

  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: RetroactiveOptions = {
    contentType: 'all',
    limit: undefined,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!.toLowerCase();

    if (arg === '--type' || arg === '-t') {
      const type = args[++i]?.toLowerCase();
      if (type === 'bill' || type === 'government_content' || type === 'court_case' || type === 'all') {
        options.contentType = type;
      }
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = parseInt(args[++i]!, 10);
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run retroactive-videos [options]

Options:
  --type, -t <type>     Content type to process: bill, government_content, court_case, or all (default: all)
  --limit, -l <number>  Maximum number of articles to process per type (default: 1000)
  --dry-run, -d         Preview what would be generated without actually generating videos
  --help, -h            Show this help message

Examples:
  npm run retroactive-videos --type bill --limit 50
  npm run retroactive-videos --dry-run
  npm run retroactive-videos --type government_content
      `);
      process.exit(0);
    }
  }

  printHeader("Configuration");
  printKeyValue("Content Type", options.contentType ?? "all");
  printKeyValue("Limit", options.limit ?? "No limit (max 1000/type)");
  printKeyValue("Dry Run", options.dryRun ? "Yes" : "No");
  printFooter();

  try {
    const totalStats: Stats = {
      totalProcessed: 0,
      videosGenerated: 0,
      errors: 0,
    };

    if (options.contentType === 'all' || options.contentType === 'bill') {
      const billStats = await processArticles('bill', options);
      totalStats.totalProcessed += billStats.totalProcessed;
      totalStats.videosGenerated += billStats.videosGenerated;
      totalStats.errors += billStats.errors;
    }

    if (options.contentType === 'all' || options.contentType === 'government_content') {
      const contentStats = await processArticles('government_content', options);
      totalStats.totalProcessed += contentStats.totalProcessed;
      totalStats.videosGenerated += contentStats.videosGenerated;
      totalStats.errors += contentStats.errors;
    }

    if (options.contentType === 'all' || options.contentType === 'court_case') {
      const caseStats = await processArticles('court_case', options);
      totalStats.totalProcessed += caseStats.totalProcessed;
      totalStats.videosGenerated += caseStats.videosGenerated;
      totalStats.errors += caseStats.errors;
    }

    printHeader("Summary");
    printKeyValue("Total Processed", totalStats.totalProcessed);
    printKeyValue("Videos Generated", totalStats.videosGenerated);
    printKeyValue("Errors", totalStats.errors);
    printFooter();

    logger.success("Retroactive video generation completed!");
  } catch (error) {
    logger.error('Error running retroactive video generation', error);
    process.exit(1);
  }
}

main();
