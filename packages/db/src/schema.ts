import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  pgTable,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import type { BillBriefRecord, BillSectionNotes } from "@acme/validators";

// Custom bytea type for binary data storage
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: unknown): Buffer {
    return value as Buffer;
  },
});

// Custom tsvector type for generated full-text search columns
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Per-scraper incremental cursor.
 *
 * Deliberately its own table rather than a max() over scraped rows. The cursor
 * must mean "how far the sequential feed walk has got", and row data cannot
 * express that: a targeted `--bill` backfill of a recent bill would push a
 * derived max() forward and strand every older bill behind it — the same class
 * of silent skip this table exists to prevent. Only the feed walk writes here.
 */
export const ScraperCursor = pgTable("scraper_cursor", (t) => ({
  // e.g. "congress:119:house" — chamber and congress each walk independently.
  scraperKey: t.varchar({ length: 100 }).notNull().primaryKey(),
  // The source's own timestamp (congress.gov `updateDate`) of the newest item
  // we have durably persisted, never our own write clock.
  sourceUpdatedAt: t.timestamp({ withTimezone: true }).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

/**
 * Items the feed walk could not finish, to be retried later.
 *
 * A single monotonic cursor forces a false choice: advance past an item we
 * failed to finish (and never see it again) or hold the cursor on it (and stall
 * the whole walk behind one bad item). This table is the third option — the
 * cursor advances, and the item goes to the back of a queue with a growing
 * backoff. Each run drains what is due before walking the feed.
 *
 * A row here means "we know about this item and have not finished it". Rows are
 * deleted the moment the item lands, so a non-empty table is a live to-do list
 * and its depth is the health signal to watch.
 */
export const ScraperRetry = pgTable(
  "scraper_retry",
  (t) => ({
    // Matches ScraperCursor.scraperKey, e.g. "congress:119".
    scraperKey: t.varchar("scraper_key", { length: 100 }).notNull(),
    // Scraper-specific identity, opaque to this table. congress.ts uses
    // "{billType}/{billNumber}" (e.g. "hr/7008") — enough to re-fetch it.
    itemKey: t.varchar("item_key", { length: 100 }).notNull(),
    attempts: t.integer().notNull().default(1),
    lastReason: t.text("last_reason"),
    // When the item becomes eligible again. Backoff grows with `attempts` so a
    // permanently broken item costs a run one attempt a day, not one per run.
    nextAttemptAt: t
      .timestamp("next_attempt_at", { withTimezone: true })
      .notNull(),
    firstFailedAt: t
      .timestamp("first_failed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.scraperKey, table.itemKey] }),
    dueIndex: index("scraper_retry_due_idx").on(
      table.scraperKey,
      table.nextAttemptAt,
    ),
  }),
);

// Bills table for congressional legislation
export const Bill = pgTable(
  "bill",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    billNumber: t.varchar({ length: 100 }).notNull(), // e.g., "H.R. 1234"
    title: t.text().notNull(),
    description: t.text(),
    sponsor: t.varchar({ length: 256 }),
    // Full latest-action text from the source, not a short label. Sized as
    // varchar(100) for the original "Introduced"/"Passed House" labels, it
    // silently rejected every congress.gov bill whose action text ran longer —
    // the INSERT failed outright, so the bill was simply absent. Left as text:
    // it is not in the search vector, so there is no ceiling to respect, and a
    // length here only has to disagree with a caller's slice() once to start
    // dropping records again.
    status: t.text(),
    introducedDate: t.timestamp(),
    congress: t.integer(), // e.g., 118 for 118th Congress
    chamber: t.varchar({ length: 50 }), // "House" or "Senate"
    summary: t.text(),
    fullText: t.text(),
    aiGeneratedArticle: t.text(), // AI-generated accessible article version
    thumbnailUrl: t.text(), // URL of the thumbnail image
    images: t
      .jsonb()
      .$type<
        { url: string; alt: string; source: string; sourceUrl: string }[]
      >()
      .default([]), // Array of relevant images for the article
    actions: t
      .jsonb()
      .$type<
        { date: string; text: string; type?: string; actionCode?: string }[]
      >()
      .default([]),
    url: t.text().notNull(),
    sourceWebsite: t.varchar({ length: 50 }).notNull(), // "congress.gov"
    // The source's own last-modified time (congress.gov `updateDate`), as
    // distinct from `updatedAt`, which is when *we* last wrote the row. The
    // scraper's incremental cursor is max() of this column: comparing our
    // write clock against the source's clock silently skipped every bill a
    // run fetched but did not persist.
    sourceUpdatedAt: t.timestamp({ withTimezone: true }),
    contentHash: t.varchar({ length: 64 }).notNull().default(""), // SHA-256 hash for version tracking
    versions: t
      .jsonb()
      .$type<{ hash: string; updatedAt: string; changes: string }[]>()
      .default([]), // Version history
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
    // Bill-level metadata only. Legislative text is indexed per section below;
    // keeping a multi-megabyte omnibus out of this generated expression avoids
    // PostgreSQL's 1 MiB to_tsvector input ceiling.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`(
        setweight(to_tsvector('english', coalesce(bill_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(sponsor, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '')), 'B')
      )`,
    ),
  }),
  (table) => ({
    descriptionMaxLength: check(
      "bill_description_max_100_chars",
      sql`${table.description} is null or char_length(${table.description}) <= 100`,
    ),
    uniqueBillNumberSource: unique().on(table.billNumber, table.sourceWebsite),
    searchVectorIdx: index("bill_search_vector_idx").using(
      "gin",
      table.searchVector,
    ),
    billNumberTrgmIdx: index("bill_number_trgm_idx").using(
      "gin",
      table.billNumber.op("gin_trgm_ops"),
    ),
  }),
);

export const CreateBillSchema = createInsertSchema(Bill).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Immutable snapshots of every official congress.gov text version we ingest. */
export const BillSourceVersion = pgTable(
  "bill_source_version",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    billId: t
      .uuid()
      .notNull()
      .references(() => Bill.id, { onDelete: "cascade" }),
    versionCode: t.varchar({ length: 50 }).notNull(),
    versionType: t.text().notNull(),
    officialDate: t.timestamp({ withTimezone: true }),
    sourceUrl: t.text().notNull(),
    // Congress XML is retained byte-for-byte. PostgreSQL text uses TOAST for
    // large values, so multi-megabyte omnibus versions remain practical.
    rawXml: t.text().notNull(),
    sourceHash: t.varchar({ length: 64 }).notNull(),
    parseStatus: t.varchar({ length: 20 }).notNull().default("pending"),
    parseError: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueVersion: unique().on(
      table.billId,
      table.versionCode,
      table.sourceHash,
    ),
    billIdx: index("bill_source_version_bill_idx").on(table.billId),
  }),
);

/** Addressable, independently searchable units parsed from a source version. */
export const BillSection = pgTable(
  "bill_section",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    sourceVersionId: t
      .uuid()
      .notNull()
      .references(() => BillSourceVersion.id, { onDelete: "cascade" }),
    parentSectionId: t
      .uuid()
      .references((): AnyPgColumn => BillSection.id, { onDelete: "cascade" }),
    structuralPath: t.text().notNull(),
    displayedNumber: t.text(),
    heading: t.text(),
    order: t.integer().notNull(),
    text: t.text().notNull(),
    sectionHash: t.varchar({ length: 64 }).notNull(),
    tokenCount: t.integer().notNull(),
    sourceStartOffset: t.integer(),
    sourceEndOffset: t.integer(),
    xmlId: t.text(),
    crossReferences: t.jsonb().$type<string[]>().notNull().default([]),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(text, ''))`,
    ),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => ({
    uniquePath: unique().on(table.sourceVersionId, table.structuralPath),
    sourceVersionIdx: index("bill_section_source_version_idx").on(
      table.sourceVersionId,
    ),
    parentIdx: index("bill_section_parent_idx").on(table.parentSectionId),
    searchVectorIdx: index("bill_section_search_vector_idx").using(
      "gin",
      table.searchVector,
    ),
  }),
);

/**
 * Versioned analysis of one canonical bill section.
 *
 * A row records the terminal state for that specific persisted section. On a
 * new source version, the scraper may copy a reusable result found by the
 * (sectionHash, promptVersion, modelVersion) cache key into the new section's
 * row without calling the model again.
 */
export const BillSectionAnalysis = pgTable(
  "bill_section_analysis",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    sectionId: t
      .uuid()
      .notNull()
      .references(() => BillSection.id, { onDelete: "cascade" }),
    sectionHash: t.varchar({ length: 64 }).notNull(),
    promptVersion: t.varchar({ length: 100 }).notNull(),
    modelVersion: t.varchar({ length: 100 }).notNull(),
    status: t.varchar({ length: 20 }).notNull(),
    notes: t.jsonb().$type<BillSectionNotes>(),
    error: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueSectionAnalysis: unique().on(
      table.sectionId,
      table.promptVersion,
      table.modelVersion,
    ),
    cacheKeyIdx: index("bill_section_analysis_cache_key_idx").on(
      table.sectionHash,
      table.promptVersion,
      table.modelVersion,
      table.status,
    ),
    sectionIdx: index("bill_section_analysis_section_idx").on(table.sectionId),
  }),
);

// Government Content table (executive orders, memoranda, proclamations, news articles, briefings, etc.)
export const GovernmentContent = pgTable(
  "government_content",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    title: t.text().notNull(),
    type: t.varchar({ length: 50 }).notNull(), // "Executive Order", "Memorandum", "Proclamation", "News Article", "Fact Sheet", "Briefing", etc.
    publishedDate: t.timestamp().notNull(),
    description: t.text(),
    fullText: t.text(),
    aiGeneratedArticle: t.text(), // AI-generated accessible article version
    thumbnailUrl: t.text(), // URL of the thumbnail image
    images: t
      .jsonb()
      .$type<
        { url: string; alt: string; source: string; sourceUrl: string }[]
      >()
      .default([]), // Array of relevant images for the article
    url: t.text().notNull().unique(), // Unique constraint for upsert by URL
    source: t.varchar({ length: 100 }).notNull().default("whitehouse.gov"), // Source website
    contentHash: t.varchar({ length: 64 }).notNull().default(""), // SHA-256 hash for version tracking
    versions: t
      .jsonb()
      .$type<{ hash: string; updatedAt: string; changes: string }[]>()
      .default([]), // Version history
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
    // Weighted full-text search vector: title (A), description (B), full text (C).
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`(
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
      )`,
    ),
  }),
  (table) => ({
    searchVectorIdx: index("government_content_search_vector_idx").using(
      "gin",
      table.searchVector,
    ),
  }),
);

export const CreateGovernmentContentSchema = createInsertSchema(
  GovernmentContent,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Legacy export for backward compatibility
export const PresidentialAction = GovernmentContent;
export const CreatePresidentialActionSchema = CreateGovernmentContentSchema;

// Court Cases table
export const CourtCase = pgTable(
  "court_case",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    caseNumber: t.varchar({ length: 100 }).notNull(),
    title: t.text().notNull(),
    court: t.varchar({ length: 256 }).notNull(), // e.g., "Supreme Court", "9th Circuit"
    filedDate: t.timestamp(),
    description: t.text(),
    status: t.varchar({ length: 100 }), // e.g., "Pending", "Decided"
    fullText: t.text(),
    aiGeneratedArticle: t.text(), // AI-generated accessible article version
    thumbnailUrl: t.text(), // URL of the thumbnail image
    images: t
      .jsonb()
      .$type<
        { url: string; alt: string; source: string; sourceUrl: string }[]
      >()
      .default([]), // Array of relevant images for the article
    url: t.text().notNull(),
    contentHash: t.varchar({ length: 64 }).notNull().default(""), // SHA-256 hash for version tracking
    versions: t
      .jsonb()
      .$type<{ hash: string; updatedAt: string; changes: string }[]>()
      .default([]), // Version history
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
    // Weighted full-text search vector: case number + title (A), description (B), full text (C).
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`(
        setweight(to_tsvector('english', coalesce(case_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
      )`,
    ),
  }),
  (table) => ({
    // Docket numbers only identify a case within a court: "1:25-cr-00499"
    // recurs across all 94 federal districts.
    uniqueCaseNumber: unique().on(table.caseNumber, table.court),
    searchVectorIdx: index("court_case_search_vector_idx").using(
      "gin",
      table.searchVector,
    ),
    caseNumberTrgmIdx: index("court_case_number_trgm_idx").using(
      "gin",
      table.caseNumber.op("gin_trgm_ops"),
    ),
  }),
);

export const CreateCourtCaseSchema = createInsertSchema(CourtCase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Video table for AI-generated feed content
export const Video = pgTable(
  "video",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),

    // Polymorphic reference to original content (Bill, GovernmentContent, CourtCase)
    contentType: t.varchar({ length: 20 }).notNull(), // "bill", "government_content", "court_case"
    contentId: t.uuid().notNull(), // References id from source table

    // AI-generated marketing copy
    title: t.varchar({ length: 100 }).notNull(), // Max 100 chars
    description: t.text().notNull(), // 50-word catchy headline

    // Hybrid image storage: Binary AI-generated images OR URL-based scraped thumbnails
    imageData: bytea("image_data"), // Raw JPEG bytes (AI-generated)
    imageMimeType: t.varchar("image_mime_type", { length: 50 }), // "image/jpeg"
    imageWidth: t.integer("image_width"),
    imageHeight: t.integer("image_height"),
    thumbnailUrl: t.text(), // URL from source content (scraped)

    // Metadata
    author: t.varchar({ length: 100 }), // "govtrack.com", "whitehouse.gov", etc.
    engagementMetrics: t
      .jsonb()
      .$type<{
        likes: number;
        comments: number;
        shares: number;
      }>()
      .default({ likes: 0, comments: 0, shares: 0 }),

    // Cache invalidation
    sourceContentHash: t.varchar({ length: 64 }).notNull(), // Match source content hash

    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueContentReference: unique().on(table.contentType, table.contentId),
    contentIdIndex: index("video_content_id_idx").on(table.contentId),
    createdAtIndex: index("video_created_at_idx").on(table.createdAt),
  }),
);

export const CreateVideoSchema = createInsertSchema(Video).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Elections table — persists scraped election data from Google Civic, VOTE411, etc.
export const ElectionRecord = pgTable(
  "election",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    externalId: t.varchar({ length: 100 }),
    name: t.text().notNull(),
    date: t.varchar({ length: 20 }).notNull(),
    electionType: t.varchar({ length: 20 }).notNull(),
    ocdDivisionId: t.text(),
    source: t.varchar({ length: 50 }).notNull(),
    deadlines: t
      .jsonb()
      .$type<{ date: string; description: string; type: string }[]>()
      .default([]),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueElection: unique().on(table.externalId, table.source),
  }),
);

// Role descriptions — reusable across elections, keyed by (role, level)
export const RoleDescriptionRecord = pgTable(
  "role_description",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    role: t.varchar({ length: 50 }).notNull(),
    level: t.varchar({ length: 50 }),
    description: t.text().notNull(),
    source: t.varchar({ length: 20 }).notNull().default("seed"),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueRoleLevel: unique().on(table.role, table.level),
  }),
);

// Contests / races within an election
export const ContestRecord = pgTable(
  "contest",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    electionId: t.uuid().notNull(),
    office: t.text(),
    districtName: t.text(),
    districtScope: t.varchar({ length: 50 }),
    numberElected: t.integer().default(1),
    // Referendum fields (for ballot measures)
    referendumTitle: t.text(),
    referendumSubtitle: t.text(),
    referendumText: t.text(),
    referendumProStatement: t.text(),
    referendumConStatement: t.text(),
    referendumUrl: t.text(),
    type: t.varchar({ length: 20 }).notNull(), // "candidate" | "referendum"
    roleDescription: t.text(),
    summary: t.text(),
    // True when `summary` was AI-generated rather than from an official source.
    summaryIsAiGenerated: t.boolean().default(false),
    // Official fiscal impact analysis (LAO / county registrar).
    fiscalImpact: t.text(),
    // Per-field source attribution from the cross-validation engine.
    citations: t
      .jsonb()
      .$type<
        {
          field: string;
          sourceName: string;
          sourceUrl?: string;
          tier: string;
          official: boolean;
        }[]
      >()
      .default([]),
    source: t.varchar({ length: 50 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    electionIdx: index("contest_election_id_idx").on(table.electionId),
  }),
);

// Candidates within a contest
export const CandidateRecord = pgTable(
  "candidate",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    contestId: t.uuid().notNull(),
    name: t.text().notNull(),
    party: t.varchar({ length: 100 }),
    candidateUrl: t.text(),
    photoUrl: t.text(),
    email: t.text(),
    phone: t.varchar({ length: 50 }),
    incumbent: t.boolean().default(false),
    biography: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    contestIdx: index("candidate_contest_id_idx").on(table.contestId),
  }),
);

// Polling locations / drop boxes / early vote sites
export const PollingLocationRecord = pgTable(
  "polling_location",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    electionId: t.uuid(),
    name: t.text(),
    addressLine1: t.text().notNull(),
    addressLine2: t.text(),
    city: t.text().notNull(),
    state: t.varchar({ length: 2 }).notNull(),
    zip: t.varchar({ length: 10 }).notNull(),
    hours: t.text(),
    latitude: t.doublePrecision(),
    longitude: t.doublePrecision(),
    locationType: t.varchar({ length: 20 }).notNull(), // "polling_place" | "early_vote" | "drop_box"
    voterServices: t.jsonb().$type<string[]>().default([]),
    startDate: t.varchar({ length: 20 }),
    endDate: t.varchar({ length: 20 }),
    source: t.varchar({ length: 50 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    electionIdx: index("polling_location_election_id_idx").on(table.electionId),
  }),
);

// Saved/bookmarked articles per user
export const SavedArticle = pgTable(
  "saved_article",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull(),
    contentId: t.uuid().notNull(),
    contentType: t.varchar({ length: 20 }).notNull(), // "bill" | "government_content" | "court_case"
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    uniqueSave: unique().on(table.userId, table.contentId),
    userIdx: index("saved_article_user_id_idx").on(table.userId),
  }),
);

// User preferences for content interests (topics + content types)
export const UserPreference = pgTable(
  "user_preference",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull(),
    topics: t.jsonb().$type<string[]>().default([]).notNull(),
    contentTypes: t.jsonb().$type<string[]>().default([]).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueUser: unique().on(table.userId),
  }),
);

// Blocked content (sources and topics hidden from feed)
export const BlockedContent = pgTable(
  "blocked_content",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull(),
    name: t.text().notNull(),
    type: t.varchar({ length: 20 }).notNull(), // "source" | "topic"
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    uniqueBlock: unique().on(table.userId, table.name, table.type),
    userIdIndex: index("blocked_content_user_id_idx").on(table.userId),
  }),
);

// User privacy/app settings
export const UserSettings = pgTable(
  "user_settings",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull(),
    location: t.boolean().notNull().default(true),
    personalize: t.boolean().notNull().default(true),
    analytics: t.boolean().notNull().default(false),
    crash: t.boolean().notNull().default(true),
    offline: t.boolean().notNull().default(true),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueUser: unique().on(table.userId),
  }),
);

// Legistar local government data cache tables

export const LegistarBody = pgTable(
  "legistar_body",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdiction: t.varchar({ length: 50 }).notNull(),
    bodyId: t.integer().notNull(),
    bodyGuid: t.varchar({ length: 100 }),
    name: t.text().notNull(),
    typeName: t.varchar({ length: 100 }),
    activeFlag: t.boolean().default(true),
    numberOfMembers: t.integer(),
    description: t.text(),
    contactName: t.varchar({ length: 256 }),
    contactEmail: t.varchar({ length: 256 }),
    contactPhone: t.varchar({ length: 50 }),
    fetchedAt: t.timestamp().defaultNow().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueBody: unique().on(table.jurisdiction, table.bodyId),
  }),
);

export const LegistarMatter = pgTable(
  "legistar_matter",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdiction: t.varchar({ length: 50 }).notNull(),
    matterId: t.integer().notNull(),
    matterGuid: t.varchar({ length: 100 }),
    matterFile: t.varchar({ length: 100 }),
    title: t.text().notNull(),
    name: t.text(),
    typeName: t.varchar({ length: 100 }),
    statusName: t.varchar({ length: 100 }),
    bodyName: t.varchar({ length: 256 }),
    bodyId: t.integer(),
    introDate: t.timestamp(),
    agendaDate: t.timestamp(),
    passedDate: t.timestamp(),
    enactmentDate: t.timestamp(),
    enactmentNumber: t.varchar({ length: 100 }),
    requester: t.text(),
    notes: t.text(),
    lastModifiedUtc: t.timestamp().notNull(),
    fetchedAt: t.timestamp().defaultNow().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueMatter: unique().on(table.jurisdiction, table.matterId),
    matterFileIdx: index("legistar_matter_file_idx").on(table.matterFile),
  }),
);

export const LegistarMeeting = pgTable(
  "legistar_meeting",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdiction: t.varchar({ length: 50 }).notNull(),
    eventId: t.integer().notNull(),
    eventGuid: t.varchar({ length: 100 }),
    bodyId: t.integer(),
    bodyName: t.varchar({ length: 256 }),
    date: t.timestamp().notNull(),
    time: t.text(),
    location: t.text(),
    agendaFile: t.text(),
    minutesFile: t.text(),
    videoPath: t.text(),
    agendaStatusName: t.varchar({ length: 100 }),
    minutesStatusName: t.varchar({ length: 100 }),
    comment: t.text(),
    inSiteUrl: t.text(),
    lastModifiedUtc: t.timestamp().notNull(),
    fetchedAt: t.timestamp().defaultNow().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueMeeting: unique().on(table.jurisdiction, table.eventId),
    meetingDateIdx: index("legistar_meeting_date_idx").on(table.date),
  }),
);

export const LegistarAgendaItem = pgTable(
  "legistar_agenda_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdiction: t.varchar({ length: 50 }).notNull(),
    eventItemId: t.integer().notNull(),
    eventId: t.integer().notNull(),
    agendaSequence: t.integer(),
    agendaNumber: t.varchar({ length: 50 }),
    title: t.text(),
    actionName: t.varchar({ length: 256 }),
    passedFlagName: t.varchar({ length: 50 }),
    tally: t.varchar({ length: 50 }),
    moverName: t.varchar({ length: 256 }),
    seconderName: t.varchar({ length: 256 }),
    matterId: t.integer(),
    matterFile: t.varchar({ length: 100 }),
    matterName: t.text(),
    matterType: t.varchar({ length: 100 }),
    matterStatus: t.varchar({ length: 100 }),
    consent: t.boolean().default(false),
    agendaNote: t.text(),
    minutesNote: t.text(),
    lastModifiedUtc: t.timestamp().notNull(),
    fetchedAt: t.timestamp().defaultNow().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueAgendaItem: unique().on(table.jurisdiction, table.eventItemId),
    agendaEventIdx: index("legistar_agenda_item_event_idx").on(table.eventId),
  }),
);

export const LegistarVote = pgTable(
  "legistar_vote",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdiction: t.varchar({ length: 50 }).notNull(),
    voteId: t.integer().notNull(),
    eventItemId: t.integer().notNull(),
    personId: t.integer().notNull(),
    personName: t.varchar({ length: 256 }).notNull(),
    valueName: t.varchar({ length: 50 }).notNull(),
    sort: t.integer(),
    lastModifiedUtc: t.timestamp().notNull(),
    fetchedAt: t.timestamp().defaultNow().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    uniqueVote: unique().on(table.jurisdiction, table.voteId),
    voteEventItemIdx: index("legistar_vote_event_item_idx").on(
      table.eventItemId,
    ),
    votePersonIdx: index("legistar_vote_person_idx").on(table.personId),
  }),
);

// Google Civic API response cache
export const CivicApiCache = pgTable(
  "civic_api_cache",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    addressHash: t.varchar({ length: 64 }).notNull(),
    endpoint: t.varchar({ length: 50 }).notNull(),
    params: t.text().notNull().default("{}"),
    responseData: t.jsonb().notNull(),
    fetchedAt: t.timestamp().defaultNow().notNull(),
    expiresAt: t.timestamp().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    uniqueCacheKey: unique().on(
      table.addressHash,
      table.endpoint,
      table.params,
    ),
    expiresAtIdx: index("civic_cache_expires_idx").on(table.expiresAt),
  }),
);

// Dual-lens perspectives cache — one row per content item
export const ContentLens = pgTable(
  "content_lens",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    contentType: t.varchar({ length: 20 }).notNull(), // "bill" | "government_content" | "court_case"
    contentId: t.uuid().notNull(),
    contentHash: t.varchar({ length: 64 }).notNull(),
    lensData: t
      .jsonb()
      .$type<{
        framing?: "proponent_opponent" | "left_right";
        left: {
          stance: string;
          points: {
            text: string;
            example?: string | { fact: string; relevance: string };
            sourceIds: number[];
          }[];
        };
        right: {
          stance: string;
          points: {
            text: string;
            example?: string | { fact: string; relevance: string };
            sourceIds: number[];
          }[];
        };
        sources: { id: number; title: string; url: string }[];
        generatedAt: string;
        modelVersion: string;
      }>()
      .notNull(),
    modelVersion: t.varchar({ length: 50 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueContentLens: unique().on(table.contentType, table.contentId),
    contentIdIndex: index("content_lens_content_id_idx").on(table.contentId),
  }),
);

/**
 * Structured article briefs — one row per content item, cached the same way as
 * ContentLens (regenerated when `contentHash` moves). Kept out of the content
 * tables so a brief can be regenerated, versioned, or dropped without touching
 * scraped source rows, and so the three content types can adopt it one at a
 * time. Only bills are generated today.
 */
export const ContentBrief = pgTable(
  "content_brief",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    contentType: t.varchar({ length: 20 }).notNull(), // "bill" | "government_content" | "court_case"
    contentId: t.uuid().notNull(),
    contentHash: t.varchar({ length: 64 }).notNull(),
    brief: t.jsonb().$type<BillBriefRecord>().notNull(),
    modelVersion: t.varchar({ length: 50 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueContentBrief: unique().on(table.contentType, table.contentId),
    contentIdIndex: index("content_brief_content_id_idx").on(table.contentId),
  }),
);

export * from "./auth-schema";
