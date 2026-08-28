/**
 * Database helper functions
 * Check for existing records before performing expensive operations
 */

import { and, eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  CourtCase,
  GovernmentContent,
  normalizeGovernmentContentTitleSql,
} from "@acme/db/schema";

import type { ExistingRecordCheck } from "../types.js";
import { createLogger } from "../log.js";

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
      .where(
        and(
          eq(Bill.billNumber, billNumber),
          eq(Bill.sourceWebsite, sourceWebsite),
        ),
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
    logger.error("Error checking existing bill", error);
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
    logger.error("Error checking existing government content", error);
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

  const normalized = normalizeGovernmentContentTitleSql(
    GovernmentContent.title,
  );

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
    logger.error("Error counting government content titles", error);
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
    logger.error("Error checking existing court case", error);
    return null;
  }
}
