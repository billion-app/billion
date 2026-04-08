/**
 * Shared TypeScript types for the scraper application
 * All types are derived from Drizzle schemas - NO DUPLICATION!
 */

import type { z } from 'zod/v4';
import {
  CreateBillSchema,
  CreateGovernmentContentSchema,
  CreateCourtCaseSchema,
} from '@acme/db/schema';

// Infer TypeScript types from Zod schemas (which are derived from Drizzle)
export type BillData = z.infer<typeof CreateBillSchema>;
export type GovernmentContentData = z.infer<typeof CreateGovernmentContentSchema>;
export type CourtCaseData = z.infer<typeof CreateCourtCaseSchema>;

// Image result type (used in images JSONB field, defined in schema)
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
  videosGenerated: number;
  videosSkipped: number;
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
  name: string;
  scrape: () => Promise<void>;
}
