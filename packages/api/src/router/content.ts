import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, inArray, sql, unionAll } from "@acme/db";
import { clampBillDescription } from "@acme/db/bill-description";
import { db } from "@acme/db/client";
import { resolveContentImageUrl } from "@acme/db/content-images";
import {
  Bill,
  BriefChangeImage,
  ContentBrief,
  ContentImage,
  ContentLens,
  CourtCase,
  GovernmentContent,
  SavedArticle,
} from "@acme/db/schema";
import { parseBillBriefRecord, sanitizeBillStatus } from "@acme/validators";

import type { ContentJurisdiction } from "../lib/content-jurisdiction";
import { toBillTimelineActions } from "../lib/bill-actions";
import { parseBillSponsor, sponsorRole } from "../lib/bill-sponsor";
import {
  billJurisdiction,
  displaySessionLabel,
  JURISDICTION_CODES,
  jurisdictionCode,
  JURISDICTIONS,
  officialSourceLabel,
  parseStateBillNumber,
} from "../lib/content-jurisdiction";
import { getFederalOfficialByName } from "../lib/elected-officials";
import { protectedProcedure, publicProcedure } from "../trpc";

const SAVED_CONTENT_TYPES = [
  "bill",
  "government_content",
  "court_case",
] as const;
type SavedContentType = (typeof SAVED_CONTENT_TYPES)[number];

/**
 * "When did something actually happen to this record", per content type.
 *
 * The sort key behind every "recent" listing. Two obvious candidates were both
 * measured against production and rejected:
 *
 * - `createdAt` is our INSERT clock, so it ranks *our ingestion history*. A
 *   2025 bill first scraped today outranked a 2026 bill scraped last week,
 *   which is what put "S Corporation Modernization Act of 2025" above the 2026
 *   one, and any backfill would shuffle old records to the top of Browse.
 * - `Bill.sourceUpdatedAt` is congress.gov's record-modified time, which moves
 *   on metadata refreshes rather than legislative events. In production it
 *   clustered onto 25 distinct days across 326 rows — 44 bills sharing one
 *   timestamp — and reported S. 2017 as updated 2026-08-07 when its newest
 *   action was 2025-06-10. Sorting on it put a wall of year-old bills on top.
 *
 * `lastActionAt` is the newest real legislative action, written by the
 * scrapers. It is nullable (a bill congress.gov has published no actions for),
 * so it falls through to `introducedDate`, which is populated for every row —
 * `createdAt` is a last resort that should never be reached.
 *
 * Each expression normalizes to `timestamptz` so the three can be UNIONed and
 * compared. The underlying columns are all `timestamp` without a zone holding
 * UTC values, so they are converted as UTC rather than through the session's
 * timezone — otherwise a row sorts differently depending on which server ran
 * the query.
 */
const BILL_ACTIVITY_AT = sql<Date>`coalesce(
  ${Bill.lastActionAt},
  ${Bill.introducedDate},
  ${Bill.createdAt}
) at time zone 'UTC'`;

const GOVERNMENT_CONTENT_ACTIVITY_AT = sql<Date>`coalesce(
  ${GovernmentContent.publishedDate},
  ${GovernmentContent.createdAt}
) at time zone 'UTC'`;

const COURT_CASE_ACTIVITY_AT = sql<Date>`coalesce(
  ${CourtCase.filedDate},
  ${CourtCase.createdAt}
) at time zone 'UTC'`;

function billDescription(
  description: string | null | undefined,
  summary?: string | null,
): string {
  return clampBillDescription(description ?? summary ?? "");
}

interface ContentImageRef {
  id: string;
  type: SavedContentType | "general";
  thumbnailUrl?: string;
}

export async function attachContentImages<T extends ContentImageRef>(
  items: readonly T[],
): Promise<(T & { imageUri?: string })[]> {
  if (items.length === 0) return [];

  const rows = await db
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
    );
  const pathByContent = new Map(
    rows.map((row) => [`${row.contentType}:${row.contentId}`, row.storagePath]),
  );

  return items.map((item) => ({
    ...item,
    imageUri: resolveContentImageUrl(
      item.thumbnailUrl,
      pathByContent.get(`${item.type}:${item.id}`),
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
// Bills are the only type generating briefs today.
async function getBrief(
  contentId: string,
  contentType: "bill" | "government_content" | "court_case",
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

// Helper function to get thumbnail URL for any content
export async function getThumbnailForContent(
  id: string,
  type: "bill" | "court_case" | "government_content" | "general",
): Promise<string | null> {
  try {
    let thumbnailUrl: string | null = null;
    if (type === "bill") {
      const result = await db
        .select({ thumbnailUrl: Bill.thumbnailUrl })
        .from(Bill)
        .where(eq(Bill.id, id))
        .limit(1);
      thumbnailUrl = result[0]?.thumbnailUrl ?? null;
    } else if (type === "court_case") {
      const result = await db
        .select({ thumbnailUrl: CourtCase.thumbnailUrl })
        .from(CourtCase)
        .where(eq(CourtCase.id, id))
        .limit(1);
      thumbnailUrl = result[0]?.thumbnailUrl ?? null;
    } else {
      const result = await db
        .select({ thumbnailUrl: GovernmentContent.thumbnailUrl })
        .from(GovernmentContent)
        .where(eq(GovernmentContent.id, id))
        .limit(1);
      thumbnailUrl = result[0]?.thumbnailUrl ?? null;
    }
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error fetching thumbnail for ${type} ${id}:`, error);
    return null;
  }
}

// Schema for content card with hybrid image support
const ContentCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["bill", "government_content", "court_case", "general"]),
  isAIGenerated: z.boolean(),
  thumbnailUrl: z.string().optional(),
  imageUri: z.string().optional(), // Add support for AI-generated data URIs
  billNumber: z.string().optional(), // Human-readable bill identifier, e.g. "H.R. 1234"
  jurisdiction: z.enum(JURISDICTIONS).optional(),
  jurisdictionCode: z.enum(JURISDICTION_CODES).optional(),
  billStatus: z.string().optional(),
  activityAt: z.date().optional(),
  chamber: z.string().optional(),
  sponsor: z.string().optional(),
  sessionLabel: z.string().optional(),
  sourceLabel: z.string().optional(),
});

export type ContentCard = z.infer<typeof ContentCardSchema>;

interface BillCardSource {
  id: string;
  title: string;
  description?: string | null;
  summary?: string | null;
  thumbnailUrl?: string | null;
  billNumber: string;
  sourceWebsite: string;
  status?: string | null;
  lastActionAt?: Date | null;
  introducedDate?: Date | null;
  createdAt?: Date | null;
  chamber?: string | null;
  sponsor?: string | null;
}

function toBillCard(bill: BillCardSource): ContentCard & { type: "bill" } {
  const jurisdiction = billJurisdiction(bill.sourceWebsite, bill.billNumber);
  const identity = parseStateBillNumber(bill.billNumber);
  return {
    id: bill.id,
    title: bill.title,
    description: billDescription(bill.description, bill.summary),
    type: "bill",
    isAIGenerated: false,
    thumbnailUrl: bill.thumbnailUrl ?? undefined,
    billNumber: bill.billNumber,
    jurisdiction,
    jurisdictionCode: jurisdictionCode(jurisdiction),
    billStatus: bill.status
      ? sanitizeBillStatus(bill.status) || undefined
      : undefined,
    activityAt:
      bill.lastActionAt ?? bill.introducedDate ?? bill.createdAt ?? undefined,
    chamber: bill.chamber ?? undefined,
    sponsor: bill.sponsor ?? undefined,
    sessionLabel: identity?.sessionLabel,
    sourceLabel: officialSourceLabel(jurisdiction),
  };
}

const billJurisdictionCondition = (jurisdiction: ContentJurisdiction) =>
  jurisdiction === "federal"
    ? sql`${Bill.sourceWebsite} <> 'openstates.org'`
    : sql`${Bill.sourceWebsite} = 'openstates.org' and ${Bill.billNumber} like ${`${jurisdiction.toUpperCase()} %`}`;

// Schema for detailed content
const _ContentDetailSchema = ContentCardSchema.extend({
  articleContent: z.string(),
  originalContent: z.string(),
  url: z.string().optional(), // URL to original source
});

export type ContentDetail = z.infer<typeof _ContentDetailSchema>;

export const contentRouter = {
  // Get all content from database
  getAll: publicProcedure.query(async () => {
    const bills = await db
      .select()
      .from(Bill)
      .orderBy(desc(BILL_ACTIVITY_AT))
      .limit(20);
    const governmentContent = await db
      .select()
      .from(GovernmentContent)
      .orderBy(desc(GOVERNMENT_CONTENT_ACTIVITY_AT))
      .limit(20);
    const courtCases = await db
      .select()
      .from(CourtCase)
      .orderBy(desc(COURT_CASE_ACTIVITY_AT))
      .limit(20);

    const allContent: ContentCard[] = [
      // Bills from database
      ...bills.map(toBillCard),
      // Government content (news articles, executive orders, etc.) from database
      ...governmentContent.map((content) => ({
        id: content.id,
        title: content.title,
        description: content.description ?? "",
        type: "government_content" as const,
        isAIGenerated: false,
        thumbnailUrl: content.thumbnailUrl ?? undefined,
      })),
      // Court cases from database
      ...courtCases.map((courtCase) => ({
        id: courtCase.id,
        title: courtCase.title,
        description: courtCase.description ?? "",
        type: "court_case" as const,
        isAIGenerated: false,
        thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
      })),
    ];

    return await attachContentImages(allContent);
  }),

  // Get content filtered by type from database, paginated for infinite scroll.
  //
  // Ordering is by when the *government* last touched a record, never by when
  // we stored it. `createdAt` is stamped at INSERT, so ordering by it ranks our
  // own ingestion history: a 2025 bill first scraped today outranks a 2026 bill
  // scraped last week, and any backfill run shuffles a pile of old records
  // straight to the top of Browse. That is what put "S Corporation
  // Modernization Act of 2025" directly above the 2026 one under a header
  // reading "SORTED BY RECENT".
  //
  // Only `Bill` gets a real action date. Government content and court
  // cases fall back to their publication/filing date, the closest thing each
  // has to "when this happened" — an executive order does not get amended in
  // place. Giving those tables their own activity tracking is a schema
  // change, tracked in #278.
  getByType: publicProcedure
    .input(
      z.object({
        type: z
          .enum(["all", "bill", "government_content", "court_case", "general"])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.number().int().min(0).optional(),
        jurisdiction: z.enum(JURISDICTIONS).default("federal"),
      }),
    )
    .query(async ({ input }) => {
      const { limit } = input;
      const cursor = input.cursor ?? 0;
      const jurisdiction = input.jurisdiction;

      if (!input.type || input.type === "all") {
        // Merge all three source tables into one chronological feed at the
        // database level (rather than concatenating fixed-size blocks) so
        // pagination advances correctly across types.
        const rows = await unionAll(
          db
            .select({
              id: Bill.id,
              title: Bill.title,
              description: sql<string>`coalesce(${Bill.description}, ${Bill.summary}, '')`,
              type: sql<string>`'bill'`,
              thumbnailUrl: Bill.thumbnailUrl,
              billNumber: sql<string | null>`${Bill.billNumber}`,
              sourceWebsite: sql<string | null>`${Bill.sourceWebsite}`,
              status: sql<string | null>`${Bill.status}`,
              lastActionAt: sql<Date | null>`${Bill.lastActionAt}`,
              introducedDate: sql<Date | null>`${Bill.introducedDate}`,
              chamber: sql<string | null>`${Bill.chamber}`,
              sponsor: sql<string | null>`${Bill.sponsor}`,
              activityAt: BILL_ACTIVITY_AT.as("activity_at"),
            })
            .from(Bill)
            .where(billJurisdictionCondition(jurisdiction)),
          db
            .select({
              id: GovernmentContent.id,
              title: GovernmentContent.title,
              description: sql<string>`coalesce(${GovernmentContent.description}, '')`,
              type: sql<string>`'government_content'`,
              thumbnailUrl: GovernmentContent.thumbnailUrl,
              billNumber: sql<string | null>`null`,
              sourceWebsite: sql<string | null>`null`,
              status: sql<string | null>`null`,
              lastActionAt: sql<Date | null>`null`,
              introducedDate: sql<Date | null>`null`,
              chamber: sql<string | null>`null`,
              sponsor: sql<string | null>`null`,
              activityAt: GOVERNMENT_CONTENT_ACTIVITY_AT.as("activity_at"),
            })
            .from(GovernmentContent)
            .where(sql`${jurisdiction} = 'federal'`),
          db
            .select({
              id: CourtCase.id,
              title: CourtCase.title,
              description: sql<string>`coalesce(${CourtCase.description}, '')`,
              type: sql<string>`'court_case'`,
              thumbnailUrl: CourtCase.thumbnailUrl,
              billNumber: sql<string | null>`null`,
              sourceWebsite: sql<string | null>`null`,
              status: sql<string | null>`null`,
              lastActionAt: sql<Date | null>`null`,
              introducedDate: sql<Date | null>`null`,
              chamber: sql<string | null>`null`,
              sponsor: sql<string | null>`null`,
              activityAt: COURT_CASE_ACTIVITY_AT.as("activity_at"),
            })
            .from(CourtCase)
            .where(sql`${jurisdiction} = 'federal'`),
        )
          .orderBy(sql`"activity_at" desc nulls last`)
          .limit(limit + 1)
          .offset(cursor);

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;

        const items: ContentCard[] = page.map((row) =>
          row.type === "bill" && row.billNumber && row.sourceWebsite
            ? toBillCard({
                ...row,
                billNumber: row.billNumber,
                sourceWebsite: row.sourceWebsite,
              })
            : {
                id: row.id,
                title: row.title,
                description: row.description,
                type: row.type as ContentCard["type"],
                isAIGenerated: false,
                thumbnailUrl: row.thumbnailUrl ?? undefined,
                jurisdiction: "federal",
                jurisdictionCode: "US",
              },
        );

        return {
          items: await attachContentImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }

      if (input.type === "bill") {
        const bills = await db
          .select()
          .from(Bill)
          .where(billJurisdictionCondition(jurisdiction))
          .orderBy(desc(BILL_ACTIVITY_AT))
          .limit(limit + 1)
          .offset(cursor);
        const hasMore = bills.length > limit;
        const page = hasMore ? bills.slice(0, limit) : bills;
        const items: ContentCard[] = page.map(toBillCard);
        return {
          items: await attachContentImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }

      if (input.type === "government_content" || input.type === "general") {
        if (jurisdiction !== "federal") {
          return { items: [] as ContentCard[], nextCursor: undefined };
        }
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .orderBy(desc(GOVERNMENT_CONTENT_ACTIVITY_AT))
          .limit(limit + 1)
          .offset(cursor);
        const hasMore = governmentContent.length > limit;
        const page = hasMore
          ? governmentContent.slice(0, limit)
          : governmentContent;
        const items: ContentCard[] = page.map((content) => ({
          id: content.id,
          title: content.title,
          description: content.description ?? "",
          type: "government_content" as const,
          isAIGenerated: false,
          thumbnailUrl: content.thumbnailUrl ?? undefined,
        }));
        return {
          items: await attachContentImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }

      // input.type === "court_case" — only remaining branch
      if (jurisdiction !== "federal") {
        return { items: [] as ContentCard[], nextCursor: undefined };
      }
      const courtCases = await db
        .select()
        .from(CourtCase)
        .orderBy(desc(COURT_CASE_ACTIVITY_AT))
        .limit(limit + 1)
        .offset(cursor);
      const hasMore = courtCases.length > limit;
      const page = hasMore ? courtCases.slice(0, limit) : courtCases;
      const items: ContentCard[] = page.map((courtCase) => ({
        id: courtCase.id,
        title: courtCase.title,
        description: courtCase.description ?? "",
        type: "court_case" as const,
        isAIGenerated: false,
        thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
      }));
      return {
        items: await attachContentImages(items),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Full-text search across bills, government content, and court cases.
  // Matches against the generated `search_vector` tsvector column (title,
  // summary/description, full text) and, for bill/case numbers, a pg_trgm
  // trigram similarity match so loose codes like "hr1234" still find
  // "H.R. 1234".
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        type: z
          .enum(["all", "bill", "government_content", "court_case", "general"])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
        jurisdiction: z.enum(JURISDICTIONS).default("federal"),
      }),
    )
    .query(async ({ input }) => {
      const { limit, query } = input;
      const type = input.type ?? "all";
      const jurisdiction = input.jurisdiction;
      const tsQuery = sql`websearch_to_tsquery('english', ${query})`;

      const billRank = sql<number>`greatest(
        ts_rank_cd(${Bill.searchVector}, ${tsQuery}),
        similarity(${Bill.billNumber}, ${query})
      )`;
      const billMatch = sql`(
        ${Bill.searchVector} @@ ${tsQuery} or ${Bill.billNumber} % ${query}
      )`;

      const govRank = sql<number>`ts_rank_cd(${GovernmentContent.searchVector}, ${tsQuery})`;
      const govMatch = sql`${GovernmentContent.searchVector} @@ ${tsQuery}`;

      const caseRank = sql<number>`greatest(
        ts_rank_cd(${CourtCase.searchVector}, ${tsQuery}),
        similarity(${CourtCase.caseNumber}, ${query})
      )`;
      const caseMatch = sql`(
        ${CourtCase.searchVector} @@ ${tsQuery} or ${CourtCase.caseNumber} % ${query}
      )`;

      if (type === "bill") {
        const bills = await db
          .select()
          .from(Bill)
          .where(and(billMatch, billJurisdictionCondition(jurisdiction)))
          .orderBy(desc(billRank))
          .limit(limit);
        const items: ContentCard[] = bills.map(toBillCard);
        return await attachContentImages(items);
      }

      if (type === "government_content" || type === "general") {
        if (jurisdiction !== "federal") return [];
        const governmentContent = await db
          .select()
          .from(GovernmentContent)
          .where(govMatch)
          .orderBy(desc(govRank))
          .limit(limit);
        const items: ContentCard[] = governmentContent.map((content) => ({
          id: content.id,
          title: content.title,
          description: content.description ?? "",
          type: "government_content" as const,
          isAIGenerated: false,
          thumbnailUrl: content.thumbnailUrl ?? undefined,
        }));
        return await attachContentImages(items);
      }

      if (type === "court_case") {
        if (jurisdiction !== "federal") return [];
        const courtCases = await db
          .select()
          .from(CourtCase)
          .where(caseMatch)
          .orderBy(desc(caseRank))
          .limit(limit);
        const items: ContentCard[] = courtCases.map((courtCase) => ({
          id: courtCase.id,
          title: courtCase.title,
          description: courtCase.description ?? "",
          type: "court_case" as const,
          isAIGenerated: false,
          thumbnailUrl: courtCase.thumbnailUrl ?? undefined,
        }));
        return await attachContentImages(items);
      }

      // "all" — union matches from all three tables, re-ranked together.
      // Postgres derives a UNION's output column names from the first
      // branch's select list, so the raw sql expressions below need an
      // explicit `.as(...)` alias for the outer ORDER BY to reference them.
      const rows = await unionAll(
        db
          .select({
            id: Bill.id,
            title: Bill.title,
            description:
              sql<string>`coalesce(${Bill.description}, ${Bill.summary}, '')`.as(
                "description",
              ),
            type: sql<string>`'bill'`.as("type"),
            thumbnailUrl: Bill.thumbnailUrl,
            billNumber: sql<string | null>`${Bill.billNumber}`,
            sourceWebsite: sql<string | null>`${Bill.sourceWebsite}`,
            status: sql<string | null>`${Bill.status}`,
            lastActionAt: sql<Date | null>`${Bill.lastActionAt}`,
            introducedDate: sql<Date | null>`${Bill.introducedDate}`,
            chamber: sql<string | null>`${Bill.chamber}`,
            sponsor: sql<string | null>`${Bill.sponsor}`,
            rank: billRank.as("rank"),
          })
          .from(Bill)
          .where(and(billMatch, billJurisdictionCondition(jurisdiction))),
        db
          .select({
            id: GovernmentContent.id,
            title: GovernmentContent.title,
            description:
              sql<string>`coalesce(${GovernmentContent.description}, '')`.as(
                "description",
              ),
            type: sql<string>`'government_content'`.as("type"),
            thumbnailUrl: GovernmentContent.thumbnailUrl,
            billNumber: sql<string | null>`null`,
            sourceWebsite: sql<string | null>`null`,
            status: sql<string | null>`null`,
            lastActionAt: sql<Date | null>`null`,
            introducedDate: sql<Date | null>`null`,
            chamber: sql<string | null>`null`,
            sponsor: sql<string | null>`null`,
            rank: govRank.as("rank"),
          })
          .from(GovernmentContent)
          .where(and(govMatch, sql`${jurisdiction} = 'federal'`)),
        db
          .select({
            id: CourtCase.id,
            title: CourtCase.title,
            description: sql<string>`coalesce(${CourtCase.description}, '')`.as(
              "description",
            ),
            type: sql<string>`'court_case'`.as("type"),
            thumbnailUrl: CourtCase.thumbnailUrl,
            billNumber: sql<string | null>`null`,
            sourceWebsite: sql<string | null>`null`,
            status: sql<string | null>`null`,
            lastActionAt: sql<Date | null>`null`,
            introducedDate: sql<Date | null>`null`,
            chamber: sql<string | null>`null`,
            sponsor: sql<string | null>`null`,
            rank: caseRank.as("rank"),
          })
          .from(CourtCase)
          .where(and(caseMatch, sql`${jurisdiction} = 'federal'`)),
      )
        .orderBy(sql`"rank" desc`)
        .limit(limit);

      const items: ContentCard[] = rows.map((row) =>
        row.type === "bill" && row.billNumber && row.sourceWebsite
          ? toBillCard({
              ...row,
              billNumber: row.billNumber,
              sourceWebsite: row.sourceWebsite,
            })
          : {
              id: row.id,
              title: row.title,
              description: row.description,
              type: row.type as ContentCard["type"],
              isAIGenerated: false,
              thumbnailUrl: row.thumbnailUrl ?? undefined,
              jurisdiction: "federal",
              jurisdictionCode: "US",
            },
      );
      return await attachContentImages(items);
    }),

  // Get detailed content by ID from database
  getById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      // Try to find in bills
      const bill = await db
        .select()
        .from(Bill)
        .where(eq(Bill.id, input.id))
        .limit(1);
      if (bill[0]) {
        const b = bill[0];
        const jurisdiction = billJurisdiction(b.sourceWebsite, b.billNumber);
        const stateIdentity = parseStateBillNumber(b.billNumber);
        const sponsorIdentity = b.sponsor
          ? parseBillSponsor(b.sponsor, jurisdiction)
          : undefined;
        // The people export is a network fetch, so run it alongside the other
        // per-bill lookups and treat a miss as "no headshot" rather than an
        // error — the card falls back to initials.
        const [official, lensData, brief] = await Promise.all([
          sponsorIdentity && jurisdiction === "federal"
            ? getFederalOfficialByName(
                sponsorIdentity.name,
                b.chamber,
                sponsorIdentity.state,
              ).catch(() => undefined)
            : undefined,
          getLensData(b.id, "bill"),
          getBrief(b.id, "bill"),
        ]);
        const sponsor = sponsorIdentity
          ? {
              ...sponsorIdentity,
              role: sponsorRole(b.chamber, jurisdiction),
              imageUrl: official?.image,
            }
          : undefined;
        const [result] = await attachContentImages([
          {
            id: b.id,
            title: b.title,
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
            status: b.status ?? undefined,
            lensData,
            brief,
          },
        ]);
        if (!result) throw new Error(`Failed to decorate bill ${b.id}`);
        return result;
      }

      // Try to find in government content
      const content = await db
        .select()
        .from(GovernmentContent)
        .where(eq(GovernmentContent.id, input.id))
        .limit(1);
      if (content[0]) {
        const c = content[0];
        const [result] = await attachContentImages([
          {
            id: c.id,
            title: c.title,
            description: c.description ?? "",
            type: "government_content" as const,
            isAIGenerated: !!c.aiGeneratedArticle,
            thumbnailUrl: c.thumbnailUrl ?? undefined,
            billNumber: undefined,
            articleContent:
              c.aiGeneratedArticle ?? c.fullText ?? "No content available",
            originalContent: c.fullText ?? "Full text not available",
            url: c.url,
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
        .select()
        .from(CourtCase)
        .where(eq(CourtCase.id, input.id))
        .limit(1);
      if (courtCase[0]) {
        const c = courtCase[0];
        const [result] = await attachContentImages([
          {
            id: c.id,
            title: c.title,
            description: c.description ?? "",
            type: "court_case" as const,
            isAIGenerated: !!c.aiGeneratedArticle,
            thumbnailUrl: c.thumbnailUrl ?? undefined,
            billNumber: undefined,
            articleContent:
              c.aiGeneratedArticle ?? c.fullText ?? "No content available",
            originalContent: c.fullText ?? "Full text not available",
            url: c.url,
            lensData: await getLensData(c.id, "court_case"),
          },
        ]);
        if (!result) throw new Error(`Failed to decorate court case ${c.id}`);
        return result;
      }

      throw new Error(`Content with id ${input.id} not found`);
    }),

  // Profile and related legislation for the member who formally sponsored a bill.
  getSponsorProfile: publicProcedure
    .input(z.object({ billId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [bill] = await db
        .select()
        .from(Bill)
        .where(eq(Bill.id, input.billId))
        .limit(1);

      if (!bill) throw new Error(`Bill with id ${input.billId} not found`);
      if (!bill.sponsor) return null;

      const jurisdiction = billJurisdiction(
        bill.sourceWebsite,
        bill.billNumber,
      );
      const sponsorIdentity = parseBillSponsor(bill.sponsor, jurisdiction);
      const [sponsoredBillRows, official] = await Promise.all([
        db
          .select({
            id: Bill.id,
            title: Bill.title,
            description: Bill.description,
            summary: Bill.summary,
            billNumber: Bill.billNumber,
            status: Bill.status,
            thumbnailUrl: Bill.thumbnailUrl,
            introducedDate: Bill.introducedDate,
          })
          .from(Bill)
          .where(eq(Bill.sponsor, bill.sponsor))
          .orderBy(desc(Bill.introducedDate), desc(Bill.createdAt))
          .limit(20),
        jurisdiction === "federal"
          ? getFederalOfficialByName(
              sponsorIdentity.name,
              bill.chamber,
              sponsorIdentity.state,
            ).catch(() => undefined)
          : undefined,
      ]);
      const sponsoredBills = await attachContentImages(
        sponsoredBillRows.map((item) => ({
          ...item,
          type: "bill" as const,
          thumbnailUrl: item.thumbnailUrl ?? undefined,
        })),
      );

      return {
        jurisdiction,
        sponsor: {
          ...sponsorIdentity,
          role: sponsorRole(bill.chamber, jurisdiction),
          imageUrl: official?.image,
        },
        sourceUrl: bill.url,
        sponsoredBills: sponsoredBills.map((item) => ({
          id: item.id,
          title: item.title,
          description: billDescription(item.description, item.summary),
          billNumber: item.billNumber,
          status: item.status ?? undefined,
          thumbnailUrl: item.thumbnailUrl,
          imageUri: item.imageUri,
          introducedDate: item.introducedDate?.toISOString(),
        })),
      };
    }),

  // --- Saved Articles ---
  saved: {
    // Paginated list of the current user's saved articles, newest first.
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(50).default(10),
          cursor: z.number().int().min(0).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const { limit, cursor = 0 } = input;

        const saved = await db
          .select()
          .from(SavedArticle)
          .where(eq(SavedArticle.userId, userId))
          .orderBy(desc(SavedArticle.createdAt), desc(SavedArticle.id))
          .limit(limit + 1)
          .offset(cursor);

        const hasMore = saved.length > limit;
        const page = hasMore ? saved.slice(0, limit) : saved;

        const results = await Promise.all(
          page.map(async (s) => {
            if (s.contentType === "bill") {
              const [row] = await db
                .select({
                  id: Bill.id,
                  title: Bill.title,
                  description: Bill.description,
                  thumbnailUrl: Bill.thumbnailUrl,
                  billNumber: Bill.billNumber,
                  sourceWebsite: Bill.sourceWebsite,
                  status: Bill.status,
                  lastActionAt: Bill.lastActionAt,
                  introducedDate: Bill.introducedDate,
                  chamber: Bill.chamber,
                  sponsor: Bill.sponsor,
                })
                .from(Bill)
                .where(eq(Bill.id, s.contentId))
                .limit(1);
              return row
                ? { ...row, type: "bill" as const, savedAt: s.createdAt }
                : null;
            }
            if (s.contentType === "government_content") {
              const [row] = await db
                .select({
                  id: GovernmentContent.id,
                  title: GovernmentContent.title,
                  description: GovernmentContent.description,
                  thumbnailUrl: GovernmentContent.thumbnailUrl,
                })
                .from(GovernmentContent)
                .where(eq(GovernmentContent.id, s.contentId))
                .limit(1);
              return row
                ? {
                    ...row,
                    type: "government_content" as const,
                    savedAt: s.createdAt,
                  }
                : null;
            }
            const [row] = await db
              .select({
                id: CourtCase.id,
                title: CourtCase.title,
                description: CourtCase.description,
                thumbnailUrl: CourtCase.thumbnailUrl,
              })
              .from(CourtCase)
              .where(eq(CourtCase.id, s.contentId))
              .limit(1);
            return row
              ? { ...row, type: "court_case" as const, savedAt: s.createdAt }
              : null;
          }),
        );

        const items = results
          .filter((item) => item != null)
          .map((item) =>
            item.type === "bill"
              ? { ...toBillCard(item), savedAt: item.savedAt }
              : {
                  ...item,
                  description: item.description ?? "",
                  thumbnailUrl: item.thumbnailUrl ?? undefined,
                  jurisdiction: "federal" as const,
                  jurisdictionCode: "US" as const,
                },
          );
        return {
          items: await attachContentImages(items),
          nextCursor: hasMore ? cursor + limit : undefined,
        };
      }),

    // Save an article for the current user (no-op if already saved).
    add: protectedProcedure
      .input(
        z.object({
          contentId: z.string().uuid(),
          contentType: z.enum(SAVED_CONTENT_TYPES),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        await db
          .insert(SavedArticle)
          .values({
            userId,
            contentId: input.contentId,
            contentType: input.contentType,
          })
          .onConflictDoNothing();
        return { success: true };
      }),

    // Remove a saved article for the current user.
    remove: protectedProcedure
      .input(z.object({ contentId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        await db
          .delete(SavedArticle)
          .where(
            and(
              eq(SavedArticle.userId, userId),
              eq(SavedArticle.contentId, input.contentId),
            ),
          );
        return { success: true };
      }),

    // Whether the given content is already saved by the current user.
    isSaved: protectedProcedure
      .input(z.object({ contentId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const [row] = await db
          .select({ id: SavedArticle.id })
          .from(SavedArticle)
          .where(
            and(
              eq(SavedArticle.userId, userId),
              eq(SavedArticle.contentId, input.contentId),
            ),
          )
          .limit(1);
        return { saved: !!row };
      }),
  },
} satisfies TRPCRouterRecord;
