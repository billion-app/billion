/**
 * Database helper functions
 * Check for existing records before performing expensive operations
 */

import { eq, and, isNull, or, inArray, sql } from '@acme/db';
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
 * Count how many rows from `source` carry each of the given normalized titles.
 *
 * Used to stop the Federal Register re-ingesting documents whitehouse.gov has
 * already published days earlier. Returns counts rather than booleans because a
 * title does not identify a document — see `normalizeTitle` — and the caller
 * has to know whether it is looking at one prior row or three.
 *
 * Normalisation is applied in SQL so it matches `normalizeTitle` exactly and
 * the comparison stays on the database side; pulling every presidential
 * document back to normalise in JS would grow with the archive.
 *
 * @param normalizedTitles - Titles already passed through `normalizeTitle`
 * @param source - Value of `government_content.source` to count within
 * @returns Map of normalized title to row count; absent means zero
 */
export async function countGovernmentContentTitles(
  normalizedTitles: readonly string[],
  source: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (normalizedTitles.length === 0) return counts;

  const normalized = sql<string>`lower(regexp_replace(${GovernmentContent.title}, '[^a-zA-Z0-9]', '', 'g'))`;

  try {
    const rows = await db
      .select({ key: normalized, total: sql<number>`count(*)::int` })
      .from(GovernmentContent)
      .where(
        and(
          eq(GovernmentContent.source, source),
          inArray(normalized, [...normalizedTitles]),
        ),
      )
      .groupBy(normalized);

    for (const row of rows) {
      counts.set(row.key, Number(row.total));
    }
  } catch (error) {
    // An empty map means "nothing already covers these", so a failure here
    // costs a duplicate row rather than a silently dropped document. That is
    // the right way round: a duplicate is visible and fixable, while a document
    // that was never stored looks identical to one that was never published.
    logger.error('Error counting government content titles', error);
  }

  return counts;
}

/**
 * Check if a court case already exists and retrieve its metadata
 * @param caseNumber - Docket number, unique only within its court
 * @param court - Court display name
 * @returns Existing record metadata or null if not found
 */
export async function checkExistingCourtCase(
  caseNumber: string,
  court: string,
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
      .where(
        and(eq(CourtCase.caseNumber, caseNumber), eq(CourtCase.court, court)),
      )
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
        .where(
          or(
            isNull(Video.id),
            and(
              eq(Video.contentType, 'bill'),
              isNull(Video.imageData),
              isNull(Video.thumbnailUrl),
            ),
          ),
        )
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
        .where(
          or(
            isNull(Video.id),
            and(
              eq(Video.contentType, 'government_content'),
              isNull(Video.imageData),
              isNull(Video.thumbnailUrl),
            ),
          ),
        )
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
        .where(
          or(
            isNull(Video.id),
            and(
              eq(Video.contentType, 'court_case'),
              isNull(Video.imageData),
              isNull(Video.thumbnailUrl),
            ),
          ),
        )
        .limit(limit);

      return casesWithoutVideos.map(c => ({ ...c, source: 'court' }));
    }
  } catch (error) {
    logger.error(`Error finding ${contentType} articles without videos`, error);
    return [];
  }
}
