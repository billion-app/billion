/**
 * VOTE411.org Ballot Lookup - Playwright-based scraper
 *
 * This module provides address-based ballot lookup functionality for VOTE411.org.
 * It uses Playwright to handle the JavaScript-rendered ballot widget.
 *
 * Usage:
 *   import { Vote411BallotLookup } from './vote411-ballot';
 *
 *   const lookup = new Vote411BallotLookup();
 *   await lookup.initialize();
 *
 *   const ballot = await lookup.lookupByAddress('123 Main St, San Jose, CA 95112');
 *   console.log(ballot);
 *
 *   await lookup.close();
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { createLogger } from "../utils/log.js";

const logger = createLogger("VOTE411-Ballot");

// Cache directory
const CACHE_DIR = join(process.cwd(), ".cache", "vote411-ballots");

// Rate limiting
const MIN_REQUEST_DELAY = 2000; // Be extra respectful with browser automation
let lastRequestTime = 0;

// ==================== Types ====================

export interface BallotCandidate {
  name: string;
  party?: string;
  photoUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  biography?: string;
  questionnaire: QuestionnaireResponse[];
}

export interface QuestionnaireResponse {
  question: string;
  answer: string;
}

export interface BallotRace {
  office: string;
  description?: string;
  district?: string;
  candidates: BallotCandidate[];
}

export interface BallotMeasure {
  name: string;
  title: string;
  description?: string;
  summary?: string;
  proArguments: string[];
  conArguments: string[];
  fullText?: string;
}

export interface Election {
  name: string;
  date: string;
  races: BallotRace[];
  measures: BallotMeasure[];
}

export interface BallotInfo {
  address: string;
  normalizedAddress?: string;
  lookupTimestamp: Date;
  pollingLocation?: {
    name?: string;
    address: string;
    hours?: string;
  };
  elections: Election[];
  errors?: string[];
}

interface CacheEntry {
  data: BallotInfo;
  timestamp: number;
  address: string;
}

// ==================== Utilities ====================

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(address: string): string {
  const normalized = address.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("md5").update(normalized).digest("hex");
}

function getCachePath(address: string): string {
  return join(CACHE_DIR, `${getCacheKey(address)}.json`);
}

function readCache(address: string, maxAgeMs: number = 86400000): BallotInfo | null {
  ensureCacheDir();
  const cachePath = getCachePath(address);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const cached: CacheEntry = JSON.parse(readFileSync(cachePath, "utf-8"));
    const age = Date.now() - cached.timestamp;

    if (age > maxAgeMs) {
      logger.debug(`Cache expired for address lookup`);
      return null;
    }

    logger.debug(`Cache hit for address lookup`);
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(address: string, data: BallotInfo): void {
  ensureCacheDir();
  const cachePath = getCachePath(address);
  const entry: CacheEntry = {
    data,
    timestamp: Date.now(),
    address,
  };

  writeFileSync(cachePath, JSON.stringify(entry, null, 2));
  logger.debug(`Cached ballot lookup result`);
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_REQUEST_DELAY) {
    const delay = MIN_REQUEST_DELAY - elapsed;
    logger.debug(`Rate limiting: waiting ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }

  lastRequestTime = Date.now();
}

// ==================== Vote411BallotLookup Class ====================

export class Vote411BallotLookup {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private initialized = false;

  constructor(private options: { headless?: boolean; cacheMaxAgeMs?: number } = {}) {
    this.options = {
      headless: options.headless ?? true,
      cacheMaxAgeMs: options.cacheMaxAgeMs ?? 86400000, // 24 hours default
    };
  }

  /**
   * Initialize the browser for ballot lookups
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info("Initializing ballot lookup browser...");

    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: ["--disable-dev-shm-usage"],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();
    this.initialized = true;

    logger.success("Ballot lookup browser initialized");
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.initialized = false;
      logger.info("Ballot lookup browser closed");
    }
  }

  /**
   * Look up ballot information by address
   */
  async lookupByAddress(
    address: string,
    options: { useCache?: boolean; waitForCandidates?: boolean } = {}
  ): Promise<BallotInfo> {
    const { useCache = true, waitForCandidates = true } = options;

    // Check cache first
    if (useCache) {
      const cached = readCache(address, this.options.cacheMaxAgeMs);
      if (cached) {
        return cached;
      }
    }

    if (!this.initialized || !this.page) {
      await this.initialize();
    }

    await rateLimit();

    const result: BallotInfo = {
      address,
      lookupTimestamp: new Date(),
      elections: [],
      errors: [],
    };

    try {
      logger.info(`Looking up ballot for: ${address}`);

      // Navigate to the ballot page
      await this.page!.goto("https://www.vote411.org/ballot", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // Wait for the ballot widget to load - it may take a while
      try {
        await this.page!.waitForSelector(".lwv-ballot-widget--root", { timeout: 20000 });
      } catch {
        // Widget class may not exist, try waiting for any form element
        await this.page!.waitForTimeout(5000);
      }

      // Wait a bit more for the widget to fully initialize
      await this.page!.waitForTimeout(3000);

      // Find and fill the address input
      // The widget has various possible input selectors
      const addressInput = await this.page!.$(
        'input[placeholder*="Main St" i], ' +
        '.lwv-ballot-widget--root input[type="text"], ' +
        '.ballot-iframe-wrapper input[type="text"], ' +
        'input[placeholder*="address" i], ' +
        'input[placeholder*="Enter" i], ' +
        'input[placeholder*="street" i], ' +
        'input[aria-label*="address" i], ' +
        'input.address-input, ' +
        'input#address'
      );

      if (!addressInput) {
        // Try to find input inside an iframe
        const frames = this.page!.frames();
        let foundInput = false;
        for (const frame of frames) {
          try {
            const frameInput = await frame.$('input[type="text"]');
            if (frameInput) {
              await frameInput.fill(address);
              await frameInput.press("Enter");
              foundInput = true;
              break;
            }
          } catch {
            // Frame may not be accessible
          }
        }
        if (!foundInput) {
          result.errors!.push("Could not find address input field - the ballot widget may require JavaScript that is not fully loaded");
          return result;
        }
      } else {
        // Clear any existing text and enter the address
        await addressInput.click({ clickCount: 3 }); // Select all
        await addressInput.fill(address);

        // Wait for autocomplete to potentially appear
        await this.page!.waitForTimeout(2000);

        // The VOTE411 widget uses a "Get Started" button
        const searchButton = await this.page!.$(
          'button:has-text("Get Started"), ' +
          'button:has-text("Search"), ' +
          'button:has-text("Find"), ' +
          'button:has-text("Go"), ' +
          'button[type="submit"]'
        );
        if (searchButton) {
          await searchButton.click();
        } else {
          await addressInput.press("Enter");
        }
      }

      // Wait for settings modal and click through
      await this.page!.waitForTimeout(3000);

      // Click Save & View Races button if present
      const saveRacesBtn = await this.page!.$(
        'button:has-text("Save & View Races"), ' +
        'button:has-text("View Races")'
      );
      if (saveRacesBtn) {
        await saveRacesBtn.click();
        await this.page!.waitForTimeout(3000);
      }

      // Wait for results to load - look for "Your Races" section or similar
      try {
        await this.page!.waitForSelector(
          ':has-text("Your Races"), ' +
          ':has-text("View Race"), ' +
          '.election, .race, .ballot-race, .ballot-results, .no-results, .error-message',
          { timeout: 30000 }
        );
      } catch {
        result.errors!.push("Timeout waiting for ballot results");
        return result;
      }

      // Check for errors or no results
      const noResults = await this.page!.$('.no-results, .error-message, :text("No elections found"), :text("not found")');
      if (noResults) {
        const errorText = await noResults.textContent();
        result.errors!.push(errorText?.trim() || "No ballot information found for this address");
        return result;
      }

      // Get the normalized address if displayed
      const normalizedAddressEl = await this.page!.$('.matched-address, .address-result, .your-address');
      if (normalizedAddressEl) {
        result.normalizedAddress = (await normalizedAddressEl.textContent())?.trim();
      }

      // Get polling location if available
      const pollingEl = await this.page!.$('.polling-location, .poll-location, .voting-location');
      if (pollingEl) {
        const pollingAddress = await pollingEl.$('.address');
        const pollingHours = await pollingEl.$('.hours');
        result.pollingLocation = {
          address: (await pollingAddress?.textContent())?.trim() || "",
          hours: (await pollingHours?.textContent())?.trim(),
        };
      }

      // Parse the ballot content
      const html = await this.page!.content();
      await this.parseBallotContent(html, result, waitForCandidates);

      // Cache successful results
      if (result.elections.length > 0 && useCache) {
        writeCache(address, result);
      }

      logger.success(
        `Found ${result.elections.length} election(s) with ` +
        `${result.elections.reduce((acc, e) => acc + e.races.length, 0)} race(s)`
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Ballot lookup failed: ${message}`);
      result.errors!.push(`Lookup failed: ${message}`);
    }

    return result;
  }

  /**
   * Parse ballot content from HTML
   */
  private async parseBallotContent(
    html: string,
    result: BallotInfo,
    _expandCandidates: boolean
  ): Promise<void> {
    const $ = cheerio.load(html);

    // VOTE411 uses a specific structure with racelist-container and detail-list-row
    const flatElection: Election = {
      name: "Your Races",
      date: "",
      races: [],
      measures: [],
    };

    // Try to get the address display
    const addressDisplay = $('.lwv--address-display-container').text().trim();
    if (addressDisplay) {
      result.normalizedAddress = addressDisplay;
    }

    // Parse races from VOTE411's structure
    // Each race is a detail-list-row button within racelist-container
    const racelistContainer = $('.racelist-container');

    if (racelistContainer.length > 0) {
      racelistContainer.find('.detail-list-row, [data-testid="detail-list-row-outer"]').each((_, el) => {
        const $row = $(el);
        // The race name is in the button text, excluding "Please select" and "View Race"
        const fullText = $row.text().trim();
        const officeName = fullText
          .replace(/Please select a candidate\(s\)/gi, '')
          .replace(/View Race/gi, '')
          .trim();

        if (officeName) {
          flatElection.races.push({
            office: officeName,
            candidates: [], // Candidates need to be fetched by clicking "View Race"
          });
        }
      });
    }

    // Also try generic race parsing for other structures
    if (flatElection.races.length === 0) {
      // Try election sections
      const electionSelectors = [
        '.election',
        '.ballot-election',
        '[data-election]',
        '.election-section',
        '.your-races-page-container',
      ];

      for (const selector of electionSelectors) {
        $(selector).each((_, el) => {
          const $el = $(el);

          // Parse races within this election
          $el.find('.race, .ballot-race, .contest, [data-race]').each((_, raceEl) => {
            const $race = $(raceEl);
            const race = this.parseRace($race);
            if (race.office) {
              flatElection.races.push(race);
            }
          });

          // Parse ballot measures
          $el.find('.measure, .ballot-measure, .proposition, [data-measure]').each((_, measureEl) => {
            const $measure = $(measureEl);
            const measure = this.parseMeasure($measure);
            if (measure.name || measure.title) {
              flatElection.measures.push(measure);
            }
          });
        });

        if (flatElection.races.length > 0) break;
      }
    }

    // Last resort: try to extract race names from text patterns
    if (flatElection.races.length === 0) {
      const pageText = $('body').text();
      // Look for patterns like "DC Mayor", "US Senator", etc.
      const racePatterns = [
        /([A-Z]{2})\s+(United States Senator|Mayor|Attorney General|Governor|Secretary of State)/gi,
        /([A-Z]{2})\s+(?:U\.?S\.?|United States)\s+(Senator|Representative|House)/gi,
        /(President|Vice President)\s+of\s+(?:the\s+)?United States/gi,
      ];

      for (const pattern of racePatterns) {
        const matches = pageText.match(pattern);
        if (matches) {
          for (const match of matches) {
            const officeName = match.trim();
            if (officeName && !flatElection.races.some(r => r.office === officeName)) {
              flatElection.races.push({
                office: officeName,
                candidates: [],
              });
            }
          }
        }
      }
    }

    if (flatElection.races.length > 0 || flatElection.measures.length > 0) {
      result.elections.push(flatElection);
    }
  }

  /**
   * Parse a race element
   */
  private parseRace($race: cheerio.Cheerio<any>): BallotRace {
    const race: BallotRace = {
      office: $race.find('.race-name, .office-name, .contest-name, h3, h4').first().text().trim(),
      description: $race.find('.race-description, .contest-description').first().text().trim() || undefined,
      district: $race.find('.district, .district-name').first().text().trim() || undefined,
      candidates: [],
    };

    // Parse candidates
    $race.find('.candidate, .ballot-candidate, [data-candidate]').each((_, candEl) => {
      const $cand = $race.find(candEl);
      const candidate = this.parseCandidate($cand);
      if (candidate.name) {
        race.candidates.push(candidate);
      }
    });

    return race;
  }

  /**
   * Parse a candidate element
   */
  private parseCandidate($cand: cheerio.Cheerio<any>): BallotCandidate {
    return {
      name: $cand.find('.candidate-name, .name, h4, h5').first().text().trim(),
      party: $cand.find('.party, .candidate-party').first().text().trim() || undefined,
      photoUrl: $cand.find('img.candidate-photo, img.photo').first().attr('src') || undefined,
      website: $cand.find('a.website, a[href*="http"]').first().attr('href') || undefined,
      biography: $cand.find('.bio, .biography').first().text().trim() || undefined,
      questionnaire: [],
    };
  }

  /**
   * Parse a ballot measure element
   */
  private parseMeasure($measure: cheerio.Cheerio<any>): BallotMeasure {
    const measure: BallotMeasure = {
      name: $measure.find('.measure-name, .measure-number, .proposition-number').first().text().trim(),
      title: $measure.find('.measure-title, .proposition-title, h3, h4').first().text().trim(),
      description: $measure.find('.measure-description, .summary').first().text().trim() || undefined,
      proArguments: [],
      conArguments: [],
    };

    // Parse pro/con arguments
    $measure.find('.pro-argument, .argument-for').each((_, el) => {
      const text = $measure.find(el).text().trim();
      if (text) measure.proArguments.push(text);
    });

    $measure.find('.con-argument, .argument-against').each((_, el) => {
      const text = $measure.find(el).text().trim();
      if (text) measure.conArguments.push(text);
    });

    return measure;
  }

  /**
   * Expand candidate details by clicking on each candidate
   */
  private async expandCandidateDetails(result: BallotInfo): Promise<void> {
    if (!this.page) return;

    try {
      // Find all expandable candidate elements
      const candidateLinks = await this.page.$$('.candidate-link, .candidate-name[role="button"], .expand-candidate');

      for (let i = 0; i < Math.min(candidateLinks.length, 20); i++) { // Limit to prevent too many clicks
        try {
          const link = candidateLinks[i];
          if (!link) continue;
          await link.click();
          await this.page.waitForTimeout(500); // Brief wait for content to expand

          // Try to find questionnaire responses in the expanded content
          const questionnaireEl = await this.page.$('.questionnaire, .candidate-responses, .qa-section');
          if (questionnaireEl) {
            const qaHtml = await questionnaireEl.innerHTML();
            const $ = cheerio.load(qaHtml);

            const responses: QuestionnaireResponse[] = [];
            $('.question-answer, .qa-pair, .response').each((_, el) => {
              const question = $(el).find('.question').text().trim();
              const answer = $(el).find('.answer').text().trim();
              if (question && answer) {
                responses.push({ question, answer });
              }
            });

            // Match responses to the corresponding candidate in result
            // This is approximate - in a real implementation you'd track which candidate was clicked
            if (responses.length > 0) {
              logger.debug(`Found ${responses.length} questionnaire responses`);
            }
          }

          // Close the expanded section if there's a close button
          const closeBtn = await this.page.$('.close-candidate, .collapse-candidate, [aria-label="Close"]');
          if (closeBtn) {
            await closeBtn.click();
            await this.page.waitForTimeout(200);
          }
        } catch {
          // Continue with other candidates if one fails
        }
      }
    } catch (error) {
      logger.debug(`Could not expand candidate details: ${error}`);
    }
  }

  /**
   * Look up ballot by ZIP code only (less precise, may show multiple districts)
   */
  async lookupByZip(zipCode: string, options: { useCache?: boolean } = {}): Promise<BallotInfo> {
    // ZIP code lookups typically just use the ZIP as the address
    return this.lookupByAddress(zipCode, options);
  }
}

// ==================== Convenience Functions ====================

let sharedLookup: Vote411BallotLookup | null = null;

/**
 * Get a shared ballot lookup instance (creates one if needed)
 */
export async function getSharedLookup(): Promise<Vote411BallotLookup> {
  if (!sharedLookup) {
    sharedLookup = new Vote411BallotLookup();
    await sharedLookup.initialize();
  }
  return sharedLookup;
}

/**
 * Close the shared ballot lookup instance
 */
export async function closeSharedLookup(): Promise<void> {
  if (sharedLookup) {
    await sharedLookup.close();
    sharedLookup = null;
  }
}

/**
 * Quick ballot lookup by address (uses shared instance)
 */
export async function quickLookupByAddress(address: string): Promise<BallotInfo> {
  const lookup = await getSharedLookup();
  return lookup.lookupByAddress(address);
}

/**
 * Quick ballot lookup by ZIP code (uses shared instance)
 */
export async function quickLookupByZip(zipCode: string): Promise<BallotInfo> {
  const lookup = await getSharedLookup();
  return lookup.lookupByZip(zipCode);
}
