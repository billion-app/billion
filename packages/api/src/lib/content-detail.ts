import { TRPCError } from "@trpc/server";

import { and, eq, inArray } from "@acme/db";
import { clampBillDescription } from "@acme/db/bill-description";
import { db } from "@acme/db/client";
import {
  EXECUTIVE_ORDER_FALLBACK_IMAGE_URL,
  resolveContentImageUrl,
} from "@acme/db/content-images";
import {
  Bill,
  BriefChangeImage,
  ContentBrief,
  ContentImage,
  ContentLens,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";
import { parseBillBriefRecord, parseCourtBriefRecord } from "@acme/validators";

import type { ContentJurisdiction } from "./content-jurisdiction";
import { billIntroductionDate, toBillTimelineActions } from "./bill-actions";
import { parseBillSponsor, sponsorRole } from "./bill-sponsor";
import { projectBillStatus } from "./bill-status";
import {
  billJurisdiction,
  displaySessionLabel,
  jurisdictionCode,
  officialSourceLabel,
  parseStateBillNumber,
} from "./content-jurisdiction";
import { courtSourceDate, governmentSourceDate } from "./content-source-date";
import { getFederalOfficialByName } from "./elected-officials";

export function billDescription(
  description: string | null | undefined,
  summary?: string | null,
): string {
  return clampBillDescription(description ?? summary ?? "");
}

interface ContentImageRef {
  id: string;
  type: "bill" | "government_content" | "court_case" | "general";
  thumbnailUrl?: string;
}

export async function attachContentImages<T extends ContentImageRef>(
  items: readonly T[],
): Promise<(T & { imageUri?: string })[]> {
  if (items.length === 0) return [];

  const governmentIds = items
    .filter((item) => item.type === "government_content")
    .map((item) => item.id);
  const [rows, executiveOrders] = await Promise.all([
    db
      .select({
        contentType: ContentImage.contentType,
        contentId: ContentImage.contentId,
        storagePath: ContentImage.storagePath,
      })
      .from(ContentImage)
      .where(
        inArray(
          ContentImage.contentId,
          items.map((item) => item.id),
        ),
      ),
    governmentIds.length > 0
      ? db
          .select({ id: GovernmentContent.id })
          .from(GovernmentContent)
          .where(
            and(
              inArray(GovernmentContent.id, governmentIds),
              eq(GovernmentContent.type, "Executive Order"),
            ),
          )
      : Promise.resolve([]),
  ]);
  const executiveOrderIds = new Set(executiveOrders.map((item) => item.id));
  const pathByContent = new Map(
    rows.map((row) => [`${row.contentType}:${row.contentId}`, row.storagePath]),
  );

  return items.map((item) => ({
    ...item,
    imageUri: resolveContentImageUrl(
      item.thumbnailUrl,
      pathByContent.get(`${item.type}:${item.id}`),
      undefined,
      item.type === "government_content" && executiveOrderIds.has(item.id)
        ? EXECUTIVE_ORDER_FALLBACK_IMAGE_URL
        : undefined,
    ),
  }));
}

// Look up cached dual-lens perspectives for a content item. Returns null when
// none have been generated yet; the client omits the panel until analysis exists.
async function getLensData(
  contentId: string,
  contentType: "bill" | "government_content" | "court_case",
) {
  const [lens] = await db
    .select({ lensData: ContentLens.lensData })
    .from(ContentLens)
    .where(
      and(
        eq(ContentLens.contentId, contentId),
        eq(ContentLens.contentType, contentType),
      ),
    )
    .limit(1);
  return lens?.lensData ?? null;
}

// Look up the cached structured brief for a content item. Rows written by an
// older shipped shapes are normalized here, so the client can treat a present
// brief as renderable while the scraper refreshes stale rows independently.
// Court briefs have a separate projection and never enter the bill parser.
async function getBrief(
  contentId: string,
  contentType: "bill" | "government_content" | "court_case",
  translationOnly = false,
) {
  const [row] = await db
    .select({ id: ContentBrief.id, brief: ContentBrief.brief })
    .from(ContentBrief)
    .where(
      and(
        eq(ContentBrief.contentId, contentId),
        eq(ContentBrief.contentType, contentType),
      ),
    )
    .limit(1);
  if (!row) return null;
  const parsed = parseBillBriefRecord(row.brief);
  if (!parsed) return null;
  if (translationOnly) return parsed;

  // Change artwork is stored per change rather than inside the brief JSON, so
  // it is attached here. A change with no row, or a row deliberately recorded
  // without bytes, simply has no image — the card renders fine without one.
  const art = await db
    .select({
      changeIndex: BriefChangeImage.changeIndex,
      imageData: BriefChangeImage.imageData,
      imageMimeType: BriefChangeImage.imageMimeType,
    })
    .from(BriefChangeImage)
    .where(eq(BriefChangeImage.contentBriefId, row.id));

  const uriByIndex = new Map(
    art.flatMap((item) =>
      item.imageData && item.imageMimeType
        ? [
            [
              item.changeIndex,
              `data:${item.imageMimeType};base64,${item.imageData.toString("base64")}`,
            ] as const,
          ]
        : [],
    ),
  );
  if (uriByIndex.size === 0) return parsed;

  return {
    ...parsed,
    changes: parsed.changes.map((change, index) => {
      const imageUri = uriByIndex.get(index);
      return imageUri ? { ...change, imageUri } : change;
    }),
  };
}

/**
 * The reader payload for one content item. Shared by `getById` and
 * `getTranslation`, which overlays translated prose on this English record.
 */
export async function loadContentDetail(input: {
  id: string;
  supportsMassachusetts?: boolean;
  translationOnly?: boolean;
}) {
  const decorate = input.translationOnly
    ? <T extends ContentImageRef>(
        items: readonly T[],
      ): Promise<(T & { imageUri?: string })[]> => Promise.resolve([...items])
    : attachContentImages;
  // Try to find in bills
  const bill = await db
    .select({
      id: Bill.id,
      title: Bill.title,
      billNumber: Bill.billNumber,
      sourceWebsite: Bill.sourceWebsite,
      sponsor: Bill.sponsor,
      chamber: Bill.chamber,
      introducedDate: Bill.introducedDate,
      actions: Bill.actions,
      status: Bill.status,
      createdAt: Bill.createdAt,
      updatedAt: Bill.updatedAt,
      description: Bill.description,
      summary: Bill.summary,
      aiGeneratedArticle: Bill.aiGeneratedArticle,
      fullText: Bill.fullText,
      thumbnailUrl: Bill.thumbnailUrl,
      url: Bill.url,
    })
    .from(Bill)
    .where(eq(Bill.id, input.id))
    .limit(1);
  if (bill[0]) {
    const b = bill[0];
    const jurisdiction = billJurisdiction(b.sourceWebsite, b.billNumber);
    if (jurisdiction === "ma" && !input.supportsMassachusetts)
      throw new TRPCError({ code: "NOT_FOUND" });
    const stateIdentity = parseStateBillNumber(b.billNumber);
    const sponsorIdentity = b.sponsor
      ? parseBillSponsor(b.sponsor, jurisdiction)
      : undefined;
    // The people export is a network fetch, so run it alongside the other
    // per-bill lookups and treat a miss as "no headshot" rather than an
    // error — the card falls back to initials.
    const [official, lensData, brief] = await Promise.all([
      !input.translationOnly && sponsorIdentity && jurisdiction === "federal"
        ? getFederalOfficialByName(
            sponsorIdentity.name,
            b.chamber,
            sponsorIdentity.state,
          ).catch(() => undefined)
        : undefined,
      getLensData(b.id, "bill"),
      getBrief(b.id, "bill", input.translationOnly),
    ]);
    const sponsor = sponsorIdentity
      ? {
          ...sponsorIdentity,
          role: sponsorRole(b.chamber, jurisdiction),
          imageUrl: official?.image,
        }
      : undefined;
    const introducedDate = billIntroductionDate({
      jurisdiction,
      introducedDate: b.introducedDate,
      actions: b.actions,
    });
    const [result] = await decorate([
      {
        id: b.id,
        title: b.title,
        introducedDate,
        sourceDate: introducedDate
          ? {
              kind: "introduced" as const,
              date: introducedDate,
              timeZone: "UTC",
            }
          : null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt ?? b.createdAt,
        description: billDescription(b.description, b.summary),
        type: "bill" as const,
        isAIGenerated: !!b.aiGeneratedArticle,
        thumbnailUrl: b.thumbnailUrl ?? undefined,
        billNumber: b.billNumber,
        jurisdiction,
        jurisdictionCode: jurisdictionCode(jurisdiction),
        sessionLabel: displaySessionLabel(
          jurisdiction,
          stateIdentity?.sessionLabel,
        ),
        sourceLabel: officialSourceLabel(jurisdiction),
        sponsor,
        articleContent:
          b.aiGeneratedArticle ?? b.fullText ?? "No content available",
        originalContent: b.fullText ?? "Full text not available",
        url: b.url,
        actions: toBillTimelineActions(b.actions ?? []),
        status: projectBillStatus(b),
        lensData,
        brief,
      },
    ]);
    if (!result) throw new Error(`Failed to decorate bill ${b.id}`);
    return result;
  }

  // Try to find in government content
  const content = await db
    .select({
      id: GovernmentContent.id,
      title: GovernmentContent.title,
      type: GovernmentContent.type,
      publishedDate: GovernmentContent.publishedDate,
      source: GovernmentContent.source,
      createdAt: GovernmentContent.createdAt,
      updatedAt: GovernmentContent.updatedAt,
      description: GovernmentContent.description,
      aiGeneratedArticle: GovernmentContent.aiGeneratedArticle,
      fullText: GovernmentContent.fullText,
      thumbnailUrl: GovernmentContent.thumbnailUrl,
      url: GovernmentContent.url,
      federalRegisterUrl: GovernmentContent.federalRegisterUrl,
    })
    .from(GovernmentContent)
    .where(eq(GovernmentContent.id, input.id))
    .limit(1);
  if (content[0]) {
    const c = content[0];
    const [result] = await decorate([
      {
        id: c.id,
        title: c.title,
        sourceDate: governmentSourceDate(c),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? c.createdAt,
        description: c.description ?? "",
        type: "government_content" as const,
        governmentContentType: c.type,
        isAIGenerated: !!c.aiGeneratedArticle,
        thumbnailUrl: c.thumbnailUrl ?? undefined,
        billNumber: undefined,
        articleContent:
          c.aiGeneratedArticle ?? c.fullText ?? "No content available",
        originalContent: c.fullText ?? "Full text not available",
        url: c.url,
        officialUrl: c.federalRegisterUrl ?? undefined,
        lensData: await getLensData(c.id, "government_content"),
      },
    ]);
    if (!result) {
      throw new Error(`Failed to decorate government content ${c.id}`);
    }
    return result;
  }

  // Try to find in court cases
  const courtCase = await db
    .select({
      id: CourtCase.id,
      title: CourtCase.title,
      filedDate: CourtCase.filedDate,
      createdAt: CourtCase.createdAt,
      updatedAt: CourtCase.updatedAt,
      description: CourtCase.description,
      aiGeneratedArticle: CourtCase.aiGeneratedArticle,
      fullText: CourtCase.fullText,
      thumbnailUrl: CourtCase.thumbnailUrl,
      url: CourtCase.url,
      contentHash: CourtCase.contentHash,
    })
    .from(CourtCase)
    .where(eq(CourtCase.id, input.id))
    .limit(1);
  if (courtCase[0]) {
    const c = courtCase[0];
    const [briefRows, lensData] = await Promise.all([
      db
        .select({
          contentHash: ContentBrief.contentHash,
          brief: ContentBrief.brief,
        })
        .from(ContentBrief)
        .where(
          and(
            eq(ContentBrief.contentId, c.id),
            eq(ContentBrief.contentType, "court_case"),
          ),
        )
        .limit(1),
      getLensData(c.id, "court_case"),
    ]);
    const [storedBrief] = briefRows;
    const courtBrief =
      storedBrief?.contentHash === c.contentHash
        ? parseCourtBriefRecord(storedBrief.brief, c.contentHash)
        : null;
    const [result] = await decorate([
      {
        id: c.id,
        title: c.title,
        sourceDate: courtSourceDate(c),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? c.createdAt,
        description: c.description ?? "",
        type: "court_case" as const,
        isAIGenerated: !!courtBrief || !!c.aiGeneratedArticle,
        thumbnailUrl: c.thumbnailUrl ?? undefined,
        billNumber: undefined,
        articleContent:
          c.aiGeneratedArticle ?? c.fullText ?? "No content available",
        originalContent: c.fullText ?? "Full text not available",
        url: c.url,
        courtBrief,
        lensData,
        jurisdiction: courtJurisdiction(c.url),
        jurisdictionCode: jurisdictionCode(courtJurisdiction(c.url)),
      },
    ]);
    if (!result) throw new Error(`Failed to decorate court case ${c.id}`);
    return result;
  }

  // A typed code rather than a bare Error: the public share page turns
  // this one case into a 404 and has to let every other failure through
  // to the logs, which it cannot do if they all look alike.
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `Content with id ${input.id} not found`,
  });
}

export const courtJurisdiction = (url: string): ContentJurisdiction =>
  url.startsWith("https://ecourtrecords.org/us/massachusetts/")
    ? "ma"
    : "federal";
