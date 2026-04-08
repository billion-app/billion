/**
 * Database helper functions
 * Check for existing records before performing expensive operations
 */

import { eq, and, isNull } from '@acme/db';
import { db } from '@acme/db/client';
import { Bill, GovernmentContent, CourtCase, Video } from '@acme/db/schema';
import type { ExistingRecordCheck } from '../types.js';
import { createLogger } from '../log.js';

const logger = createLogger("db");

/**
 * Check if a bill already exists and retrieve its metadata
 * @param billNumber - Bill number (e.g., "H.R. 1234")
 * @param sourceWebsite - Source website (e.g., "govtrack", "congress.gov")
 * @returns Existing record metadata or null if not found
 */
export async function checkExistingBill(
  billNumber: string,
  sourceWebsite: string,
): Promise<ExistingRecordCheck | null> {
  try {
    const [existing] = await db
      .select({
        contentHash: Bill.contentHash,
        description: Bill.description,
        aiGeneratedArticle: Bill.aiGeneratedArticle,
        thumbnailUrl: Bill.thumbnailUrl,
      })
      .from(Bill)
      .where(and(eq(Bill.billNumber, billNumber), eq(Bill.sourceWebsite, sourceWebsite)))
      .limit(1);

    if (!existing) {
      return null;
    }

    return {
      exists: true,
      contentHash: existing.contentHash,
      description: existing.description,
      hasArticle: !!existing.aiGeneratedArticle,
      hasThumbnail: !!existing.thumbnailUrl,
    };
  } catch (error) {
    logger.error('Error checking existing bill', error);
    return null;
  }
}

/**
 * Check if government content already exists and retrieve its metadata
 * @param url - Content URL (unique identifier)
 * @returns Existing record metadata or null if not found
 */
export async function checkExistingGovernmentContent(
  url: string,
): Promise<ExistingRecordCheck | null> {
  try {
    const [existing] = await db
      .select({
        contentHash: GovernmentContent.contentHash,
        description: GovernmentContent.description,
        aiGeneratedArticle: GovernmentContent.aiGeneratedArticle,
        thumbnailUrl: GovernmentContent.thumbnailUrl,
      })
      .from(GovernmentContent)
      .where(eq(GovernmentContent.url, url))
      .limit(1);

    if (!existing) {
      return null;
    }

    return {
      exists: true,
      contentHash: existing.contentHash,
      description: existing.description,
      hasArticle: !!existing.aiGeneratedArticle,
      hasThumbnail: !!existing.thumbnailUrl,
    };
  } catch (error) {
    logger.error('Error checking existing government content', error);
    return null;
  }
}

/**
 * Check if a court case already exists and retrieve its metadata
 * @param caseNumber - Case number (unique identifier)
 * @returns Existing record metadata or null if not found
 */
export async function checkExistingCourtCase(
  caseNumber: string,
): Promise<ExistingRecordCheck | null> {
  try {
    const [existing] = await db
      .select({
        contentHash: CourtCase.contentHash,
        description: CourtCase.description,
        aiGeneratedArticle: CourtCase.aiGeneratedArticle,
        thumbnailUrl: CourtCase.thumbnailUrl,
      })
      .from(CourtCase)
      .where(eq(CourtCase.caseNumber, caseNumber))
      .limit(1);

    if (!existing) {
      return null;
    }

    return {
      exists: true,
      contentHash: existing.contentHash,
      description: existing.description,
      hasArticle: !!existing.aiGeneratedArticle,
      hasThumbnail: !!existing.thumbnailUrl,
    };
  } catch (error) {
    logger.error('Error checking existing court case', error);
    return null;
  }
}

/**
 * Find articles that don't have videos yet
 * @param contentType - Type of content to query
 * @param limit - Maximum number of records to return (default: 1000)
 * @returns Array of articles without videos
 */
export async function findArticlesWithoutVideos(
  contentType: 'bill' | 'government_content' | 'court_case',
  limit: number = 1000
) {
  try {
    if (contentType === 'bill') {
      const billsWithoutVideos = await db
        .select({
          id: Bill.id,
          title: Bill.title,
          fullText: Bill.fullText,
          contentHash: Bill.contentHash,
          sourceWebsite: Bill.sourceWebsite,
          thumbnailUrl: Bill.thumbnailUrl,
        })
        .from(Bill)
        .leftJoin(Video, and(eq(Video.contentType, 'bill'), eq(Video.contentId, Bill.id)))
        .where(isNull(Video.id))
        .limit(limit);

      return billsWithoutVideos;
    } else if (contentType === 'government_content') {
      const contentWithoutVideos = await db
        .select({
          id: GovernmentContent.id,
          title: GovernmentContent.title,
          fullText: GovernmentContent.fullText,
          contentHash: GovernmentContent.contentHash,
          source: GovernmentContent.source,
          thumbnailUrl: GovernmentContent.thumbnailUrl,
        })
        .from(GovernmentContent)
        .leftJoin(Video, and(eq(Video.contentType, 'government_content'), eq(Video.contentId, GovernmentContent.id)))
        .where(isNull(Video.id))
        .limit(limit);

      return contentWithoutVideos;
    } else {
      const casesWithoutVideos = await db
        .select({
          id: CourtCase.id,
          title: CourtCase.title,
          fullText: CourtCase.fullText,
          contentHash: CourtCase.contentHash,
          thumbnailUrl: CourtCase.thumbnailUrl,
        })
        .from(CourtCase)
        .leftJoin(Video, and(eq(Video.contentType, 'court_case'), eq(Video.contentId, CourtCase.id)))
        .where(isNull(Video.id))
        .limit(limit);

      return casesWithoutVideos.map(c => ({ ...c, source: 'court' }));
    }
  } catch (error) {
    logger.error(`Error finding ${contentType} articles without videos`, error);
    return [];
  }
}
