/**
 * VOTE411.org Scraper
 *
 * Scrapes voter guide information from the League of Women Voters' VOTE411 platform.
 * This includes:
 * - State-level voting information (deadlines, rules)
 * - Available voter guides and candidate forums
 * - Election dates and information
 *
 * NOTE: Full ballot lookup by address requires JavaScript execution (browser automation)
 * as the ballot widget is client-side rendered. This scraper focuses on publicly
 * available state-level information that can be scraped with cheerio.
 *
 * For address-based ballot lookup, consider using the Playwright-based approach
 * documented in the BallotLookup class below.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

import type { Scraper } from "../utils/types.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";

const NAME = "VOTE411";
const BASE_URL = "https://www.vote411.org";
const logger = createLogger(NAME);

// Cache directory for scraped data
const CACHE_DIR = join(process.cwd(), ".cache", "vote411");

// Rate limiting: minimum delay between requests (ms)
const MIN_REQUEST_DELAY = 1000;
let lastRequestTime = 0;

// ==================== Types ====================

export interface StateInfo {
  name: string;
  slug: string;
  url: string;
}

export interface ElectionDate {
  name: string;
  date: string;
  description?: string;
}

export interface VotingDeadline {
  type: string;
  date: string;
  description?: string;
}

export interface VoterGuideLink {
  title: string;
  url: string;
  type: "pdf" | "video" | "external";
  state?: string;
}

export interface CandidateForum {
  title: string;
  url: string;
  state?: string;
  date?: string;
}

export interface StateVotingInfo {
  state: string;
  stateSlug: string;
  url: string;
  scrapedAt: Date;
  elections: ElectionDate[];
  deadlines: VotingDeadline[];
  voterGuides: VoterGuideLink[];
  alerts: string[];
}

export interface BallotRace {
  office: string;
  district?: string;
  candidates: BallotCandidate[];
}

export interface BallotCandidate {
  name: string;
  party?: string;
  photoUrl?: string;
  website?: string;
  questionnaire?: QuestionnaireResponse[];
}

export interface QuestionnaireResponse {
  question: string;
  answer: string;
}

export interface BallotMeasure {
  name: string;
  description: string;
  proArguments?: string[];
  conArguments?: string[];
  fullText?: string;
}

export interface BallotInfo {
  address: string;
  elections: Array<{
    name: string;
    date: string;
    races: BallotRace[];
    measures: BallotMeasure[];
  }>;
  pollingLocation?: {
    name: string;
    address: string;
    hours?: string;
  };
}

// ==================== Utilities ====================

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachePath(key: string): string {
  const hash = createHash("md5").update(key).digest("hex");
  return join(CACHE_DIR, `${hash}.json`);
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

function readCache<T>(key: string, maxAgeMs: number = 3600000): T | null {
  ensureCacheDir();
  const cachePath = getCachePath(key);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const cached: CacheEntry<T> = JSON.parse(readFileSync(cachePath, "utf-8"));
    const age = Date.now() - cached.timestamp;

    if (age > maxAgeMs) {
      logger.debug(`Cache expired for ${key}`);
      return null;
    }

    logger.debug(`Cache hit for ${key}`);
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  ensureCacheDir();
  const cachePath = getCachePath(key);
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    key,
  };

  writeFileSync(cachePath, JSON.stringify(entry, null, 2));
  logger.debug(`Cached ${key}`);
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_REQUEST_DELAY) {
    const delay = MIN_REQUEST_DELAY - elapsed;
    logger.debug(`Rate limiting: waiting ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }

  lastRequestTime = Date.now();

  return fetchWithRetry(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    timeoutMs: 30_000,
  });
}

// ==================== State Info Scraping ====================

const US_STATES: StateInfo[] = [
  { name: "Alabama", slug: "alabama", url: `${BASE_URL}/alabama` },
  { name: "Alaska", slug: "alaska", url: `${BASE_URL}/alaska` },
  { name: "Arizona", slug: "arizona", url: `${BASE_URL}/arizona` },
  { name: "Arkansas", slug: "arkansas", url: `${BASE_URL}/arkansas` },
  { name: "California", slug: "california", url: `${BASE_URL}/california` },
  { name: "Colorado", slug: "colorado", url: `${BASE_URL}/colorado` },
  { name: "Connecticut", slug: "connecticut", url: `${BASE_URL}/connecticut` },
  { name: "Delaware", slug: "delaware", url: `${BASE_URL}/delaware` },
  {
    name: "District of Columbia",
    slug: "district-of-columbia",
    url: `${BASE_URL}/district-of-columbia`,
  },
  { name: "Florida", slug: "florida", url: `${BASE_URL}/florida` },
  { name: "Georgia", slug: "georgia", url: `${BASE_URL}/georgia` },
  { name: "Hawaii", slug: "hawaii", url: `${BASE_URL}/hawaii` },
  { name: "Idaho", slug: "idaho", url: `${BASE_URL}/idaho` },
  { name: "Illinois", slug: "illinois", url: `${BASE_URL}/illinois` },
  { name: "Indiana", slug: "indiana", url: `${BASE_URL}/indiana` },
  { name: "Iowa", slug: "iowa", url: `${BASE_URL}/iowa` },
  { name: "Kansas", slug: "kansas", url: `${BASE_URL}/kansas` },
  { name: "Kentucky", slug: "kentucky", url: `${BASE_URL}/kentucky` },
  { name: "Louisiana", slug: "louisiana", url: `${BASE_URL}/louisiana` },
  { name: "Maine", slug: "maine", url: `${BASE_URL}/maine` },
  { name: "Maryland", slug: "maryland", url: `${BASE_URL}/maryland` },
  {
    name: "Massachusetts",
    slug: "massachusetts",
    url: `${BASE_URL}/massachusetts`,
  },
  { name: "Michigan", slug: "michigan", url: `${BASE_URL}/michigan` },
  { name: "Minnesota", slug: "minnesota", url: `${BASE_URL}/minnesota` },
  { name: "Mississippi", slug: "mississippi", url: `${BASE_URL}/mississippi` },
  { name: "Missouri", slug: "missouri", url: `${BASE_URL}/missouri` },
  { name: "Montana", slug: "montana", url: `${BASE_URL}/montana` },
  { name: "Nebraska", slug: "nebraska", url: `${BASE_URL}/nebraska` },
  { name: "Nevada", slug: "nevada", url: `${BASE_URL}/nevada` },
  {
    name: "New Hampshire",
    slug: "new-hampshire",
    url: `${BASE_URL}/new-hampshire`,
  },
  { name: "New Jersey", slug: "new-jersey", url: `${BASE_URL}/new-jersey` },
  { name: "New Mexico", slug: "new-mexico", url: `${BASE_URL}/new-mexico` },
  { name: "New York", slug: "new-york", url: `${BASE_URL}/new-york` },
  {
    name: "North Carolina",
    slug: "north-carolina",
    url: `${BASE_URL}/north-carolina`,
  },
  {
    name: "North Dakota",
    slug: "north-dakota",
    url: `${BASE_URL}/north-dakota`,
  },
  { name: "Ohio", slug: "ohio", url: `${BASE_URL}/ohio` },
  { name: "Oklahoma", slug: "oklahoma", url: `${BASE_URL}/oklahoma` },
  { name: "Oregon", slug: "oregon", url: `${BASE_URL}/oregon` },
  {
    name: "Pennsylvania",
    slug: "pennsylvania",
    url: `${BASE_URL}/pennsylvania`,
  },
  {
    name: "Rhode Island",
    slug: "rhode-island",
    url: `${BASE_URL}/rhode-island`,
  },
  {
    name: "South Carolina",
    slug: "south-carolina",
    url: `${BASE_URL}/south-carolina`,
  },
  {
    name: "South Dakota",
    slug: "south-dakota",
    url: `${BASE_URL}/south-dakota`,
  },
  { name: "Tennessee", slug: "tennessee", url: `${BASE_URL}/tennessee` },
  { name: "Texas", slug: "texas", url: `${BASE_URL}/texas` },
  { name: "Utah", slug: "utah", url: `${BASE_URL}/utah` },
  { name: "Vermont", slug: "vermont", url: `${BASE_URL}/vermont` },
  { name: "Virginia", slug: "virginia", url: `${BASE_URL}/virginia` },
  { name: "Washington", slug: "washington", url: `${BASE_URL}/washington` },
  {
    name: "West Virginia",
    slug: "west-virginia",
    url: `${BASE_URL}/west-virginia`,
  },
  { name: "Wisconsin", slug: "wisconsin", url: `${BASE_URL}/wisconsin` },
  { name: "Wyoming", slug: "wyoming", url: `${BASE_URL}/wyoming` },
];

/**
 * Scrape state-level voting information from VOTE411
 */
export async function scrapeStateInfo(
  stateSlug: string,
  useCache = true,
): Promise<StateVotingInfo | null> {
  const cacheKey = `state-info-${stateSlug}`;

  if (useCache) {
    const cached = readCache<StateVotingInfo>(cacheKey);
    if (cached) return cached;
  }

  const state = US_STATES.find((s) => s.slug === stateSlug);
  if (!state) {
    logger.warn(`Unknown state slug: ${stateSlug}`);
    return null;
  }

  try {
    logger.info(`Scraping ${state.name} voting info...`);
    const res = await rateLimitedFetch(state.url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const info: StateVotingInfo = {
      state: state.name,
      stateSlug: state.slug,
      url: state.url,
      scrapedAt: new Date(),
      elections: [],
      deadlines: [],
      voterGuides: [],
      alerts: [],
    };

    // Extract alerts
    $(".topic-alert, .state-alerts .alert--content").each((_, el) => {
      const title = $(el).find(".alert--title").text().trim();
      const text = $(el).find(".alert--text").text().trim();
      if (title || text) {
        info.alerts.push(`${title}: ${text}`.trim());
      }
    });

    // Extract upcoming elections from election cards
    $(".upcoming-election, .election-card, .election-date").each((_, el) => {
      const name = $(el).find(".election-name, h3, h4").first().text().trim();
      const date = $(el).find(".election-date, .date").first().text().trim();
      const description = $(el).find(".description, p").first().text().trim();

      if (name && date) {
        info.elections.push({
          name,
          date,
          description: description || undefined,
        });
      }
    });

    // Extract deadlines
    $(".deadline, .registration-deadline, .voting-deadline").each((_, el) => {
      const type = $(el)
        .find(".deadline-type, .type, h4")
        .first()
        .text()
        .trim();
      const date = $(el).find(".deadline-date, .date").first().text().trim();
      const description = $(el).find(".description, p").first().text().trim();

      if (type && date) {
        info.deadlines.push({
          type,
          date,
          description: description || undefined,
        });
      }
    });

    // Extract voter guide links
    $(".list__item a, .voter-guide-link").each((_, el) => {
      const $link = $(el);
      const title = $link.text().trim();
      const href = $link.attr("href");

      if (!title || !href) return;

      let type: "pdf" | "video" | "external" = "external";
      if (href.endsWith(".pdf")) {
        type = "pdf";
      } else if (
        href.includes("youtube.com") ||
        href.includes("vimeo.com") ||
        href.includes("youtu.be")
      ) {
        type = "video";
      }

      info.voterGuides.push({
        title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        type,
        state: state.name,
      });
    });

    writeCache(cacheKey, info);
    logger.success(
      `Scraped ${state.name}: ${info.elections.length} elections, ${info.voterGuides.length} guides`,
    );

    return info;
  } catch (error) {
    logger.error(`Failed to scrape ${state.name}:`, error);
    return null;
  }
}

/**
 * Scrape all states' voting information
 */
export async function scrapeAllStates(
  useCache = true,
): Promise<StateVotingInfo[]> {
  const results: StateVotingInfo[] = [];

  for (const state of US_STATES) {
    const info = await scrapeStateInfo(state.slug, useCache);
    if (info) {
      results.push(info);
    }

    // Extra delay between states to be respectful
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

// ==================== Voter Guide List Scraping ====================

/**
 * Scrape available voter guides and candidate forums from the main ballot page
 */
export async function scrapeVoterGuides(
  useCache = true,
): Promise<{ guides: VoterGuideLink[]; forums: CandidateForum[] }> {
  const cacheKey = "voter-guides-list";

  if (useCache) {
    const cached = readCache<{
      guides: VoterGuideLink[];
      forums: CandidateForum[];
    }>(cacheKey);
    if (cached) return cached;
  }

  try {
    logger.info("Scraping voter guides and forums...");
    const res = await rateLimitedFetch(`${BASE_URL}/ballot`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const guides: VoterGuideLink[] = [];
    const forums: CandidateForum[] = [];

    // Extract voting guides from the list
    $(".list:not(.list--green) .list__item a").each((_, el) => {
      const $link = $(el);
      const title = $link.find("span").text().trim() || $link.text().trim();
      const href = $link.attr("href");

      if (!title || !href) return;

      let type: "pdf" | "video" | "external" = "external";
      if (href.endsWith(".pdf")) {
        type = "pdf";
      } else if (
        href.includes("youtube.com") ||
        href.includes("vimeo.com") ||
        href.includes("youtu.be")
      ) {
        type = "video";
      }

      // Try to extract state from title (e.g., "NM: LWV Santa Fe County Voter Guide")
      const stateMatch = title.match(/^([A-Z]{2}):/);
      const state = stateMatch ? stateMatch[1] : undefined;

      guides.push({
        title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        type,
        state,
      });
    });

    // Extract candidate debate videos (green list)
    $(".list--green .list__item a").each((_, el) => {
      const $link = $(el);
      const title = $link.find("span").text().trim() || $link.text().trim();
      const href = $link.attr("href");

      if (!title || !href) return;

      // Try to extract state from title
      const stateMatch = title.match(/^([A-Z]{2})\s/);
      const state = stateMatch ? stateMatch[1] : undefined;

      forums.push({
        title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        state,
      });
    });

    const result = { guides, forums };
    writeCache(cacheKey, result);
    logger.success(`Found ${guides.length} guides and ${forums.length} forums`);

    return result;
  } catch (error) {
    logger.error("Failed to scrape voter guides:", error);
    return { guides: [], forums: [] };
  }
}

// ==================== Ballot Lookup (Requires Playwright) ====================

/**
 * NOTE: The ballot lookup functionality on VOTE411 requires JavaScript execution
 * because the ballot widget is client-side rendered using React.
 *
 * To implement full ballot lookup by address, you would need to:
 * 1. Add playwright as a dependency to this package
 * 2. Navigate to https://www.vote411.org/ballot
 * 3. Wait for the ballot widget to load (look for .lwv-ballot-widget--root)
 * 4. Enter the address in the search input
 * 5. Wait for results and parse the rendered HTML
 *
 * The ballot widget uses an API at ballot.thevoterguide.org but it requires
 * the proper authentication headers that are set by the widget JavaScript.
 *
 * Example Playwright implementation:
 *
 * ```typescript
 * import { chromium } from 'playwright';
 *
 * export async function lookupBallot(address: string): Promise<BallotInfo | null> {
 *   const browser = await chromium.launch({ headless: true });
 *   const page = await browser.newPage();
 *
 *   await page.goto('https://www.vote411.org/ballot');
 *   await page.waitForSelector('.lwv-ballot-widget--root', { timeout: 10000 });
 *
 *   // Find and fill the address input
 *   const addressInput = await page.$('input[placeholder*="address" i], input[type="text"]');
 *   if (addressInput) {
 *     await addressInput.fill(address);
 *     await addressInput.press('Enter');
 *   }
 *
 *   // Wait for results to load
 *   await page.waitForSelector('.ballot-results, .race-card', { timeout: 30000 });
 *
 *   // Parse the results
 *   const content = await page.content();
 *   const $ = cheerio.load(content);
 *
 *   // ... parse races, candidates, measures ...
 *
 *   await browser.close();
 *   return ballotInfo;
 * }
 * ```
 */

// Placeholder for ballot lookup - implement with Playwright when needed
export async function lookupBallotByAddress(
  _address: string,
): Promise<BallotInfo | null> {
  logger.warn(
    "Ballot lookup by address requires Playwright. " +
      "See the code comments for implementation guidance.",
  );
  return null;
}

// ==================== Main Scraper ====================

async function scrape(): Promise<void> {
  logger.info("Starting VOTE411 scraper...");

  // Scrape voter guides and forums from the ballot page
  const { guides, forums } = await scrapeVoterGuides();
  logger.info(
    `Found ${guides.length} voter guides and ${forums.length} candidate forums`,
  );

  // For now, we just scrape and cache the data
  // The data can be used by the app to show available voter guides

  // Optionally scrape specific states (uncomment to enable)
  // const stateInfo = await scrapeStateInfo('california');
  // if (stateInfo) {
  //   logger.info(`California: ${stateInfo.elections.length} elections`);
  // }

  logger.success("VOTE411 scraper completed");
}

export const vote411: Scraper = {
  name: NAME,
  requiredEnv: [],
  scrape,
};

// ==================== Standalone API ====================

/**
 * Get a list of all US states with their VOTE411 URLs
 */
export function getStates(): StateInfo[] {
  return US_STATES;
}

/**
 * Get cached state info if available
 */
export function getCachedStateInfo(stateSlug: string): StateVotingInfo | null {
  return readCache<StateVotingInfo>(`state-info-${stateSlug}`);
}

/**
 * Get cached voter guides if available
 */
export function getCachedVoterGuides(): {
  guides: VoterGuideLink[];
  forums: CandidateForum[];
} | null {
  return readCache<{ guides: VoterGuideLink[]; forums: CandidateForum[] }>(
    "voter-guides-list",
  );
}
