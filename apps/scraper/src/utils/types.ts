/**
 * Shared TypeScript types for the scraper application
 * All types are derived from Drizzle schemas - NO DUPLICATION!
 */

import type { z } from "zod/v4";

import type { ScraperEnvContract } from "@acme/env";
import {
  CreateBillSchema,
  CreateCourtCaseSchema,
  CreateGovernmentContentSchema,
} from "@acme/db/schema";

// Infer TypeScript types from Zod schemas (which are derived from Drizzle)
export type BillData = z.infer<typeof CreateBillSchema>;
export type GovernmentContentData = z.infer<
  typeof CreateGovernmentContentSchema
>;
export type CourtCaseData = z.infer<typeof CreateCourtCaseSchema>;

// Image result returned by Google Custom Search
export interface ImageResult {
  url: string;
  alt: string;
  source: string;
  sourceUrl: string;
}

// Metrics tracking for scraper runs (not a database entity)
export interface ScraperMetrics {
  totalProcessed: number;
  newEntries: number;
  existingUnchanged: number;
  existingChanged: number;
  aiArticlesGenerated: number;
  imagesSearched: number;
}

// Existing record check result (helper return type, not a database entity)
export interface ExistingRecordCheck {
  exists: boolean;
  contentHash?: string;
  description?: string | null;
  hasArticle: boolean;
  hasThumbnail: boolean;
}

// Scraper interface for the runner
export interface Scraper {
  id: string;
  name: string;
  source: string;
  environment: ScraperEnvContract["environment"];
  scrape: (options?: ScraperRunOptions) => Promise<void>;
}

export interface ScraperRunOptions {
  maxItems?: number;
  /**
   * Source-specific record identifiers to fetch directly, bypassing whatever
   * incremental cursor the scraper normally uses. Scrapers without a targeted
   * mode ignore this.
   */
  targets?: string[];
  /** Congress number for targeted congress.gov runs (e.g. 119). */
  congress?: number;
  /** Legislative session for targeted state runs (e.g. "20252026"). */
  session?: string;
  /**
   * Path to an unzipped bulk export to import instead of calling the source's
   * API. Scrapers without a bulk path ignore this.
   */
  bulkDir?: string;
  /**
   * Refresh the N most recently updated records instead of walking the
   * incremental cursor. Keeps active items current rather than pursuing
   * complete historical coverage. Scrapers without a recent mode ignore this.
   */
  recent?: number;
}
