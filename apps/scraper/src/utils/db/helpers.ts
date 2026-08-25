/**
 * Database helper functions
 * Check for existing records before performing expensive operations
 */

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CourtCase, GovernmentContent } from "@acme/db/schema";

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
