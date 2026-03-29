/**
 * Database operations for upserting government content
 * Handles conditional generation logic to avoid redundant API calls
 */

import { db } from '@acme/db/client';
import { Bill, GovernmentContent, CourtCase } from '@acme/db/schema';
import type { BillData, GovernmentContentData, CourtCaseData } from '../types.js';
import { createContentHash } from '../hash.js';
import { generateAISummary, generateAIArticle } from '../ai/text-generation.js';
import { generateImageSearchKeywords } from '../ai/image-keywords.js';
import { getThumbnailImage } from '../api/google-images.js';
import { checkExistingBill, checkExistingGovernmentContent, checkExistingCourtCase } from './helpers.js';
import {
  incrementTotalProcessed,
  incrementNewEntries,
  incrementExistingUnchanged,
  incrementExistingChanged,
  incrementAIArticlesGenerated,
  incrementImagesSearched,
} from './metrics.js';
import { generateVideoForContent } from './video-operations.js';

/**
 * Guard that returns true only when a text string is suitable for AI processing.
 * Requirements:
 *  - At least 200 characters
 *  - No Windows file paths (e.g. G:\...)
 *  - Fewer than 30% "boilerplate" lines (blank, single-word, or all-caps header lines)
 */
function isUsableText(text: string | undefined | null): text is string {
  if (!text || text.length < 200) return false;
  if (/[A-Z]:\\/.test(text)) return false;

  const lines = text.split('\n');
  const boilerplateLines = lines.filter(
    (line) => {
      const trimmed = line.trim();
      return (
        trimmed === '' ||
        trimmed.split(/\s+/).length === 1 ||
        (/[a-zA-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.length > 2)
      );
    }
  );
  if (boilerplateLines.length / lines.length >= 0.3) return false;

  return true;
}

/**
 * Insert or update a bill with version tracking and conditional generation
 * @param billData - Bill data to upsert
 * @returns Upserted bill record
 */
export async function upsertBill(billData: BillData) {
  // Generate contentHash for incoming data
  const contentForHash = JSON.stringify({
    title: billData.title,
    description: billData.description,
    status: billData.status,
    summary: billData.summary,
    fullText: billData.fullText,
  });
  const newContentHash = createContentHash(contentForHash);

  // Check if entry exists
  const existing = await checkExistingBill(
    billData.billNumber,
    billData.sourceWebsite
  );

  // Track metrics
  incrementTotalProcessed();

  // Determine what needs to be generated
  const hasUsableText = isUsableText(billData.fullText);
  let shouldGenerateArticle = false;
  let shouldGenerateImage = false;

  if (!existing) {
    // New entry - generate everything
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = hasUsableText;
    incrementNewEntries();
    console.log(`New bill detected: ${billData.billNumber}`);
  } else if (existing.contentHash !== newContentHash) {
    // Content changed - regenerate article, keep image
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingChanged();
    console.log(`Content changed for bill: ${billData.billNumber}`);
  } else {
    // Content unchanged
    shouldGenerateArticle = false;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingUnchanged();
    console.log(`No changes for bill: ${billData.billNumber}, skipping AI generation`);
  }

  // Generate AI summary if description is not provided
  let description = billData.description;
  if (!description && (billData.summary || billData.fullText) && shouldGenerateArticle) {
    console.log(`Generating AI summary for bill: ${billData.title}`);
    description = await generateAISummary(
      billData.title,
      billData.summary || billData.fullText || "",
    );
  }

  // Conditionally generate AI article
  let aiGeneratedArticle: string | undefined = undefined;
  if (shouldGenerateArticle && hasUsableText) {
    console.log(`Generating AI article for bill: ${billData.title}`);
    aiGeneratedArticle = await generateAIArticle(
      billData.title,
      billData.fullText!,
      "bill",
      billData.url,
    );
    incrementAIArticlesGenerated();
  } else if (existing?.hasArticle) {
    console.log(`Using existing AI article for bill: ${billData.billNumber}`);
  }

  // Conditionally search for thumbnail
  let thumbnailUrl: string | null | undefined = undefined;
  if (shouldGenerateImage) {
    try {
      console.log(`Searching for thumbnail for bill: ${billData.title}`);
      const searchQuery = await generateImageSearchKeywords(
        billData.title,
        billData.fullText || '',
        'bill'
      );
      console.log(`Image search query: ${searchQuery}`);
      thumbnailUrl = await getThumbnailImage(searchQuery);
      incrementImagesSearched();
    } catch (error) {
      console.warn(`Failed to fetch thumbnail for bill ${billData.billNumber}:`, error);
      thumbnailUrl = null; // Continue without image
    }
  } else if (existing?.hasThumbnail) {
    console.log(`Using existing thumbnail for bill: ${billData.billNumber}`);
  }

  const [result] = await db
    .insert(Bill)
    .values({
      ...billData,
      description,
      aiGeneratedArticle: aiGeneratedArticle || undefined,
      thumbnailUrl: thumbnailUrl === undefined ? undefined : thumbnailUrl || undefined,
      contentHash: newContentHash,
      versions: [],
    })
    .onConflictDoUpdate({
      target: [Bill.billNumber, Bill.sourceWebsite],
      set: {
        title: billData.title,
        description: description,
        sponsor: billData.sponsor,
        status: billData.status,
        introducedDate: billData.introducedDate,
        congress: billData.congress,
        chamber: billData.chamber,
        summary: billData.summary,
        fullText: billData.fullText,
        // Only update these if new values were generated
        ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl || undefined }),
        url: billData.url,
        contentHash: newContentHash,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`Bill ${billData.billNumber} upserted`);

  // Generate video content with hybrid image support
  if (result && billData.fullText) {
    await generateVideoForContent(
      'bill',
      result.id,
      billData.title,
      billData.fullText,
      newContentHash,
      billData.sourceWebsite,
      result.thumbnailUrl, // Pass thumbnailUrl from inserted/updated bill
    );
  }

  return result;
}

/**
 * Insert or update government content with version tracking and conditional generation
 * @param contentData - Government content data to upsert
 * @returns Upserted government content record
 */
export async function upsertGovernmentContent(contentData: GovernmentContentData) {
  // Generate contentHash for incoming data
  const contentForHash = JSON.stringify({
    title: contentData.title,
    description: contentData.description,
    fullText: contentData.fullText,
  });
  const newContentHash = createContentHash(contentForHash);

  // Check if entry exists
  const existing = await checkExistingGovernmentContent(contentData.url);

  // Track metrics
  incrementTotalProcessed();

  // Determine what needs to be generated
  const hasUsableText = isUsableText(contentData.fullText);
  let shouldGenerateArticle = false;
  let shouldGenerateImage = false;

  if (!existing) {
    // New entry - generate everything
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = hasUsableText;
    incrementNewEntries();
    console.log(`New government content detected: ${contentData.title}`);
  } else if (existing.contentHash !== newContentHash) {
    // Content changed - regenerate article, keep image
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingChanged();
    console.log(`Content changed for government content: ${contentData.title}`);
  } else {
    // Content unchanged
    shouldGenerateArticle = false;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingUnchanged();
    console.log(`No changes for government content: ${contentData.title}, skipping AI generation`);
  }

  // Conditionally generate AI article
  let aiGeneratedArticle: string | undefined = undefined;
  if (shouldGenerateArticle && hasUsableText) {
    console.log(`Generating AI article for ${contentData.type}: ${contentData.title}`);
    aiGeneratedArticle = await generateAIArticle(
      contentData.title,
      contentData.fullText!,
      contentData.type,
      contentData.url,
    );
    incrementAIArticlesGenerated();
  } else if (existing?.hasArticle) {
    console.log(`Using existing AI article for government content: ${contentData.title}`);
  }

  // Conditionally search for thumbnail
  let thumbnailUrl: string | null | undefined = undefined;
  if (shouldGenerateImage) {
    try {
      console.log(`Searching for thumbnail for ${contentData.type}: ${contentData.title}`);
      const searchQuery = await generateImageSearchKeywords(
        contentData.title,
        contentData.fullText || '',
        contentData.type
      );
      console.log(`Image search query: ${searchQuery}`);
      thumbnailUrl = await getThumbnailImage(searchQuery);
      incrementImagesSearched();
    } catch (error) {
      console.warn(`Failed to fetch thumbnail for government content "${contentData.title}":`, error);
      thumbnailUrl = null; // Continue without image
    }
  } else if (existing?.hasThumbnail) {
    console.log(`Using existing thumbnail for government content: ${contentData.title}`);
  }

  const [result] = await db
    .insert(GovernmentContent)
    .values({
      ...contentData,
      aiGeneratedArticle: aiGeneratedArticle || undefined,
      thumbnailUrl: thumbnailUrl === undefined ? undefined : thumbnailUrl || undefined,
      contentHash: newContentHash,
      versions: [],
    })
    .onConflictDoUpdate({
      target: GovernmentContent.url,
      set: {
        title: contentData.title,
        type: contentData.type,
        publishedDate: contentData.publishedDate,
        description: contentData.description,
        fullText: contentData.fullText,
        // Only update these if new values were generated
        ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl || undefined }),
        source: contentData.source,
        contentHash: newContentHash,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`Government content "${contentData.title}" upserted`);

  // Generate video content with hybrid image support
  if (result && contentData.fullText) {
    await generateVideoForContent(
      'government_content',
      result.id,
      contentData.title,
      contentData.fullText,
      newContentHash,
      contentData.source ?? 'whitehouse.gov',
      result.thumbnailUrl, // Pass thumbnailUrl from inserted/updated content
    );
  }

  return result;
}

/**
 * Legacy function name for backward compatibility
 * @param actionData - Presidential action data
 * @returns Upserted government content record
 */
export async function upsertPresidentialAction(actionData: {
  title: string;
  type: string;
  issuedDate?: Date;
  publishedDate?: Date;
  description?: string;
  fullText?: string;
  url: string;
  source?: string;
}) {
  return upsertGovernmentContent({
    ...actionData,
    publishedDate:
      actionData.publishedDate || actionData.issuedDate || new Date(),
    source: actionData.source || "whitehouse.gov",
  });
}

/**
 * Insert or update a court case with version tracking and conditional generation
 * @param caseData - Court case data to upsert
 * @returns Upserted court case record
 */
export async function upsertCourtCase(caseData: CourtCaseData) {
  // Generate contentHash for incoming data
  const contentForHash = JSON.stringify({
    title: caseData.title,
    description: caseData.description,
    status: caseData.status,
    fullText: caseData.fullText,
  });
  const newContentHash = createContentHash(contentForHash);

  // Check if entry exists
  const existing = await checkExistingCourtCase(caseData.caseNumber);

  // Track metrics
  incrementTotalProcessed();

  // Determine what needs to be generated
  const hasUsableText = isUsableText(caseData.fullText);
  let shouldGenerateArticle = false;
  let shouldGenerateImage = false;

  if (!existing) {
    // New entry - generate everything
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = hasUsableText;
    incrementNewEntries();
    console.log(`New court case detected: ${caseData.caseNumber}`);
  } else if (existing.contentHash !== newContentHash) {
    // Content changed - regenerate article, keep image
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingChanged();
    console.log(`Content changed for court case: ${caseData.caseNumber}`);
  } else {
    // Content unchanged
    shouldGenerateArticle = false;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingUnchanged();
    console.log(`No changes for court case: ${caseData.caseNumber}, skipping AI generation`);
  }

  // Generate AI summary if description is not provided
  let description = caseData.description;
  if (!description && caseData.fullText && shouldGenerateArticle) {
    console.log(`Generating AI summary for court case: ${caseData.title}`);
    description = await generateAISummary(caseData.title, caseData.fullText);
  }

  // Conditionally generate AI article
  let aiGeneratedArticle: string | undefined = undefined;
  if (shouldGenerateArticle && hasUsableText) {
    console.log(`Generating AI article for court case: ${caseData.title}`);
    aiGeneratedArticle = await generateAIArticle(
      caseData.title,
      caseData.fullText!,
      "court case",
      caseData.url,
    );
    incrementAIArticlesGenerated();
  } else if (existing?.hasArticle) {
    console.log(`Using existing AI article for court case: ${caseData.caseNumber}`);
  }

  // Conditionally search for thumbnail
  let thumbnailUrl: string | null | undefined = undefined;
  if (shouldGenerateImage) {
    try {
      console.log(`Searching for thumbnail for court case: ${caseData.title}`);
      const searchQuery = await generateImageSearchKeywords(
        caseData.title,
        caseData.fullText || '',
        'court case'
      );
      console.log(`Image search query: ${searchQuery}`);
      thumbnailUrl = await getThumbnailImage(searchQuery);
      incrementImagesSearched();
    } catch (error) {
      console.warn(`Failed to fetch thumbnail for court case ${caseData.caseNumber}:`, error);
      thumbnailUrl = null; // Continue without image
    }
  } else if (existing?.hasThumbnail) {
    console.log(`Using existing thumbnail for court case: ${caseData.caseNumber}`);
  }

  const [result] = await db
    .insert(CourtCase)
    .values({
      ...caseData,
      description,
      aiGeneratedArticle: aiGeneratedArticle || undefined,
      thumbnailUrl: thumbnailUrl === undefined ? undefined : thumbnailUrl || undefined,
      contentHash: newContentHash,
      versions: [],
    })
    .onConflictDoUpdate({
      target: CourtCase.caseNumber,
      set: {
        title: caseData.title,
        court: caseData.court,
        filedDate: caseData.filedDate,
        description: description,
        status: caseData.status,
        fullText: caseData.fullText,
        // Only update these if new values were generated
        ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl || undefined }),
        url: caseData.url,
        contentHash: newContentHash,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`Court case ${caseData.caseNumber} upserted`);

  // Generate video content with hybrid image support
  if (result && caseData.fullText) {
    await generateVideoForContent(
      'court_case',
      result.id,
      caseData.title,
      caseData.fullText,
      newContentHash,
      caseData.court,
      result.thumbnailUrl, // Pass thumbnailUrl from inserted/updated case
    );
  }

  return result;
}
