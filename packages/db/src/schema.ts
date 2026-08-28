import type { SQL, SQLWrapper } from "drizzle-orm";
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

import type { BillBriefRecord } from "@acme/validators";

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

/**
 * SQL counterpart to the scraper's presidential-title normalization.
 *
 * Keep the lookup and its expression index on the exact same syntax tree so
 * PostgreSQL can use the index when matching titles across publishers.
 */
export function normalizeGovernmentContentTitleSql(
  title: SQLWrapper,
): SQL<string> {
  return sql<string>`lower(regexp_replace(${title}, '[^a-zA-Z0-9]', '', 'g'))`;
}

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
    // Date of the newest legislative action on the bill — the canonical answer
    // to "when did something actually happen here", and the sort key behind
    // every "recent" listing.
    //
    // Deliberately not `sourceUpdatedAt`: congress.gov bumps its `updateDate`
    // for metadata refreshes, so 44 bills shared one timestamp and S. 2017 read
    // as updated 2026-08-07 when its last real action was 2025-06-10. Sorting
    // on that put a wall of year-old bills at the top of Browse. Nor
    // `createdAt`, which is our INSERT clock and ranks our ingestion history.
    lastActionAt: t.timestamp(),
    congress: t.integer(), // e.g., 118 for 118th Congress
    chamber: t.varchar({ length: 50 }), // "House" or "Senate"
    summary: t.text(),
    fullText: t.text(),
    aiGeneratedArticle: t.text(), // AI-generated accessible article version
    thumbnailUrl: t.text(), // URL of the thumbnail image
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
    // Weighted full-text search vector: bill number + title (A), sponsor +
    // summary/description (B), full text (C). Backs the `content.search`
    // procedure alongside the trigram index below for loose code matching.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`(
        setweight(to_tsvector('english', coalesce(bill_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(sponsor, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
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

/**
 * Cached editorial ranking signals for a bill.
 *
 * Popularity is deliberately absent: it comes from real save counts at query
 * time. These scores cover the two judgments that need interpretation of the
 * bill and its researched context. `contentHash` makes the cache stale as soon
 * as the underlying bill changes.
 */
export const BillInterest = pgTable(
  "bill_interest",
  (t) => ({
    billId: t
      .uuid("bill_id")
      .notNull()
      .primaryKey()
      .references(() => Bill.id, { onDelete: "cascade" }),
    contentHash: t.varchar("content_hash", { length: 64 }).notNull(),
    interestScore: t.integer("interest_score").notNull(),
    controversyScore: t.integer("controversy_score").notNull(),
    attentionScore: t.integer("attention_score").notNull(),
    reason: t.text().notNull(),
    modelVersion: t.varchar("model_version", { length: 100 }).notNull(),
    generatedAt: t
      .timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    interestRange: check(
      "bill_interest_interest_score_range",
      sql`${table.interestScore} between 0 and 100`,
    ),
    controversyRange: check(
      "bill_interest_controversy_score_range",
      sql`${table.controversyScore} between 0 and 100`,
    ),
    attentionRange: check(
      "bill_interest_attention_score_range",
      sql`${table.attentionScore} between 0 and 100`,
    ),
    interestScoreIdx: index("bill_interest_interest_score_idx").on(
      table.interestScore,
    ),
    controversyScoreIdx: index("bill_interest_controversy_score_idx").on(
      table.controversyScore,
    ),
    attentionScoreIdx: index("bill_interest_attention_score_idx").on(
      table.attentionScore,
    ),
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
    sourceNormalizedTitleIdx: index(
      "government_content_source_normalized_title_idx",
    ).on(table.source, normalizeGovernmentContentTitleSql(table.title)),
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

// Local-government decision pipeline. These tables deliberately model the
// product domain rather than Legistar's wire format so another municipal
// records adapter can populate the same read model later.

export const LocalJurisdiction = pgTable("local_jurisdiction", (t) => ({
  key: t.varchar({ length: 50 }).notNull().primaryKey(),
  name: t.varchar({ length: 256 }).notNull(),
  state: t.varchar({ length: 2 }).notNull(),
  governmentLevel: t.varchar({ length: 30 }).notNull(),
  timezone: t.varchar({ length: 64 }).notNull(),
  sourceType: t.varchar({ length: 30 }).notNull(),
  sourceClient: t.varchar({ length: 100 }).notNull(),
  sourceBaseUrl: t.text().notNull(),
  publicPortalUrl: t.text(),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => sql`now()`)
    .notNull(),
}));

export const LocalBody = pgTable(
  "local_body",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdictionKey: t
      .varchar({ length: 50 })
      .notNull()
      .references(() => LocalJurisdiction.key, { onDelete: "cascade" }),
    sourceBodyId: t.integer().notNull(),
    sourceGuid: t.varchar({ length: 100 }),
    name: t.text().notNull(),
    typeName: t.varchar({ length: 100 }),
    active: t.boolean().notNull().default(true),
    included: t.boolean().notNull().default(false),
    relevanceTier: t.integer().notNull().default(3),
    numberOfMembers: t.integer(),
    description: t.text(),
    contactName: t.varchar({ length: 256 }),
    contactEmail: t.varchar({ length: 256 }),
    contactPhone: t.varchar({ length: 50 }),
    sourceUpdatedAt: t.timestamp({ withTimezone: true }),
    lastSeenAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    uniqueSourceBody: unique().on(table.jurisdictionKey, table.sourceBodyId),
    jurisdictionIncludedIdx: index("local_body_jurisdiction_included_idx").on(
      table.jurisdictionKey,
      table.included,
      table.relevanceTier,
    ),
  }),
);

export const LocalDecision = pgTable(
  "local_decision",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdictionKey: t
      .varchar({ length: 50 })
      .notNull()
      .references(() => LocalJurisdiction.key, { onDelete: "cascade" }),
    primaryBodyId: t
      .uuid()
      .references(() => LocalBody.id, { onDelete: "set null" }),
    sourceMatterId: t.integer().notNull(),
    sourceGuid: t.varchar({ length: 100 }),
    fileNumber: t.varchar({ length: 100 }),
    title: t.text().notNull(),
    name: t.text(),
    typeName: t.varchar({ length: 100 }),
    statusName: t.varchar({ length: 100 }),
    topic: t.varchar({ length: 80 }),
    scopeKind: t.varchar({ length: 30 }).notNull().default("unknown"),
    districtNumbers: t.integer().array(),
    geographicText: t.text(),
    introDate: t.timestamp({ withTimezone: true }),
    agendaDate: t.timestamp({ withTimezone: true }),
    passedDate: t.timestamp({ withTimezone: true }),
    enactmentDate: t.timestamp({ withTimezone: true }),
    enactmentNumber: t.varchar({ length: 100 }),
    requester: t.text(),
    notes: t.text(),
    sourceUrl: t.text(),
    sourceUpdatedAt: t.timestamp({ withTimezone: true }).notNull(),
    lastSeenAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    sourceDeletedAt: t.timestamp({ withTimezone: true }),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`(
        setweight(to_tsvector('english', coalesce(file_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(type_name, '') || ' ' || coalesce(topic, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(requester, '') || ' ' || coalesce(notes, '') || ' ' || coalesce(geographic_text, '')), 'C')
      )`,
    ),
  }),
  (table) => ({
    uniqueSourceMatter: unique().on(
      table.jurisdictionKey,
      table.sourceMatterId,
    ),
    primaryBodyIdx: index("local_decision_primary_body_idx").on(
      table.primaryBodyId,
    ),
    activeUpdatedIdx: index("local_decision_active_updated_idx")
      .on(table.jurisdictionKey, table.sourceUpdatedAt)
      .where(sql`${table.sourceDeletedAt} is null`),
    searchVectorIdx: index("local_decision_search_vector_idx").using(
      "gin",
      table.searchVector,
    ),
  }),
);

export const LocalMeeting = pgTable(
  "local_meeting",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdictionKey: t
      .varchar({ length: 50 })
      .notNull()
      .references(() => LocalJurisdiction.key, { onDelete: "cascade" }),
    bodyId: t
      .uuid()
      .notNull()
      .references(() => LocalBody.id, { onDelete: "cascade" }),
    sourceEventId: t.integer().notNull(),
    sourceGuid: t.varchar({ length: 100 }),
    startsAt: t.timestamp({ withTimezone: true }).notNull(),
    localDate: t.varchar({ length: 10 }).notNull(),
    timeLabel: t.text(),
    location: t.text(),
    agendaUrl: t.text(),
    minutesUrl: t.text(),
    videoUrl: t.text(),
    sourceUrl: t.text(),
    agendaStatusName: t.varchar({ length: 100 }),
    minutesStatusName: t.varchar({ length: 100 }),
    comment: t.text(),
    cancelled: t.boolean().notNull().default(false),
    sourceUpdatedAt: t.timestamp({ withTimezone: true }).notNull(),
    lastSeenAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    sourceDeletedAt: t.timestamp({ withTimezone: true }),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    uniqueSourceEvent: unique().on(table.jurisdictionKey, table.sourceEventId),
    bodyStartsAtIdx: index("local_meeting_body_starts_at_idx").on(
      table.bodyId,
      table.startsAt,
    ),
    activeStartsAtIdx: index("local_meeting_active_starts_at_idx")
      .on(table.jurisdictionKey, table.startsAt)
      .where(sql`${table.sourceDeletedAt} is null`),
  }),
);

export const LocalMeetingItem = pgTable(
  "local_meeting_item",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    meetingId: t
      .uuid()
      .notNull()
      .references(() => LocalMeeting.id, { onDelete: "cascade" }),
    decisionId: t
      .uuid()
      .references(() => LocalDecision.id, { onDelete: "set null" }),
    sourceEventItemId: t.integer().notNull(),
    sourceGuid: t.varchar({ length: 100 }),
    agendaSequence: t.integer(),
    minutesSequence: t.integer(),
    agendaNumber: t.varchar({ length: 50 }),
    title: t.text(),
    actionName: t.varchar({ length: 256 }),
    actionText: t.text(),
    passedFlagName: t.varchar({ length: 50 }),
    tally: t.varchar({ length: 50 }),
    moverName: t.varchar({ length: 256 }),
    seconderName: t.varchar({ length: 256 }),
    consent: t.boolean().notNull().default(false),
    rollCall: t.boolean().notNull().default(false),
    agendaNote: t.text(),
    minutesNote: t.text(),
    videoIndex: t.integer(),
    sourceUpdatedAt: t.timestamp({ withTimezone: true }).notNull(),
    lastSeenAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    sourceDeletedAt: t.timestamp({ withTimezone: true }),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    uniqueSourceItem: unique().on(table.meetingId, table.sourceEventItemId),
    meetingSequenceIdx: index("local_meeting_item_sequence_idx").on(
      table.meetingId,
      table.agendaSequence,
    ),
    decisionIdx: index("local_meeting_item_decision_idx").on(table.decisionId),
  }),
);

export const LocalDecisionDocument = pgTable(
  "local_decision_document",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdictionKey: t
      .varchar({ length: 50 })
      .notNull()
      .references(() => LocalJurisdiction.key, { onDelete: "cascade" }),
    decisionId: t
      .uuid()
      .notNull()
      .references(() => LocalDecision.id, { onDelete: "cascade" }),
    sourceAttachmentId: t.integer().notNull(),
    sourceGuid: t.varchar({ length: 100 }),
    name: t.text().notNull(),
    description: t.text(),
    url: t.text().notNull(),
    fileName: t.text(),
    category: t.varchar({ length: 50 }).notNull(),
    sortOrder: t.integer(),
    isSupportingDocument: t.boolean().notNull().default(false),
    isPublicComment: t.boolean().notNull().default(false),
    processingPolicy: t.varchar({ length: 30 }).notNull(),
    extractionStatus: t.varchar({ length: 30 }).notNull().default("pending"),
    extractedText: t.text(),
    extractionMethod: t.varchar({ length: 30 }),
    extractionQuality: t.real(),
    pageCount: t.integer(),
    byteSize: t.integer(),
    mimeType: t.varchar({ length: 100 }),
    contentHash: t.varchar({ length: 64 }),
    sourceUpdatedAt: t.timestamp({ withTimezone: true }),
    lastSeenAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    sourceDeletedAt: t.timestamp({ withTimezone: true }),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    uniqueSourceAttachment: unique().on(
      table.jurisdictionKey,
      table.sourceAttachmentId,
    ),
    decisionCategoryIdx: index("local_document_decision_category_idx").on(
      table.decisionId,
      table.category,
    ),
    extractionQueueIdx: index("local_document_extraction_queue_idx")
      .on(table.extractionStatus)
      .where(sql`${table.sourceDeletedAt} is null`),
  }),
);

export const LocalDecisionHistory = pgTable(
  "local_decision_history",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    decisionId: t
      .uuid()
      .notNull()
      .references(() => LocalDecision.id, { onDelete: "cascade" }),
    sourceHistoryId: t.integer().notNull(),
    sourceEventId: t.integer(),
    sourceEventItemId: t.integer(),
    bodyName: t.varchar({ length: 256 }),
    actionName: t.varchar({ length: 256 }),
    actionText: t.text(),
    actionDate: t.timestamp({ withTimezone: true }),
    agendaNumber: t.varchar({ length: 50 }),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    uniqueSourceHistory: unique().on(table.decisionId, table.sourceHistoryId),
    decisionActionDateIdx: index("local_history_decision_action_date_idx").on(
      table.decisionId,
      table.actionDate,
    ),
  }),
);

export const LocalDecisionVote = pgTable(
  "local_decision_vote",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    meetingItemId: t
      .uuid()
      .notNull()
      .references(() => LocalMeetingItem.id, { onDelete: "cascade" }),
    sourceVoteId: t.integer().notNull(),
    sourcePersonId: t.integer().notNull(),
    personName: t.varchar({ length: 256 }).notNull(),
    valueName: t.varchar({ length: 50 }).notNull(),
    sortOrder: t.integer(),
    sourceUpdatedAt: t.timestamp({ withTimezone: true }).notNull(),
    sourcePayload: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`)
      .notNull(),
  }),
  (table) => ({
    uniqueSourceVote: unique().on(table.meetingItemId, table.sourceVoteId),
    meetingItemIdx: index("local_vote_meeting_item_idx").on(
      table.meetingItemId,
    ),
    personIdx: index("local_vote_source_person_idx").on(table.sourcePersonId),
  }),
);

export const LocalIngestionRun = pgTable(
  "local_ingestion_run",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    jurisdictionKey: t
      .varchar({ length: 50 })
      .notNull()
      .references(() => LocalJurisdiction.key, { onDelete: "cascade" }),
    status: t.varchar({ length: 20 }).notNull(),
    windowStart: t.timestamp({ withTimezone: true }).notNull(),
    windowEnd: t.timestamp({ withTimezone: true }).notNull(),
    startedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    completedAt: t.timestamp({ withTimezone: true }),
    counts: t.jsonb().$type<Record<string, number>>().notNull().default({}),
    error: t.text(),
  }),
  (table) => ({
    jurisdictionStartedIdx: index(
      "local_ingestion_jurisdiction_started_idx",
    ).on(table.jurisdictionKey, table.startedAt),
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
 * Generated header artwork. Only the immutable Supabase Storage path and its
 * checksum live in Postgres. The image bytes never consume database space.
 */
export const ContentImage = pgTable(
  "content_image",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    contentType: t.varchar("content_type", { length: 20 }).notNull(),
    contentId: t.uuid("content_id").notNull(),
    contentHash: t.varchar("content_hash", { length: 64 }).notNull(),
    storagePath: t.text("storage_path").notNull(),
    imageHash: t.varchar("image_hash", { length: 64 }).notNull(),
    prompt: t.text().notNull(),
    width: t.integer().notNull(),
    height: t.integer().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueContentImage: unique().on(table.contentType, table.contentId),
    contentIdIndex: index("content_image_content_id_idx").on(table.contentId),
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

/**
 * Generated artwork for one change inside a brief's "What would change" list.
 *
 * A row is written for every change that has been *considered*, not only those
 * that got a picture: `imageData` is null when the planner judged that no
 * photograph would help the reader. Recording that decision is the point —
 * otherwise every run would re-ask the model about the same abstract
 * procedural change forever.
 *
 * `changeHash` covers the change's own text rather than the brief's
 * `contentHash`. A regenerated brief usually rewrites some changes and leaves
 * others alone, so hashing per change keeps the untouched artwork instead of
 * discarding a whole bill's images because one sentence moved. It also detects
 * the case a positional key cannot: a regenerated brief may emit a *different
 * number* of changes, so index 3 can quietly become a different subject.
 */
export const BriefChangeImage = pgTable(
  "brief_change_image",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    contentBriefId: t
      .uuid()
      .notNull()
      .references(() => ContentBrief.id, { onDelete: "cascade" }),
    changeIndex: t.integer().notNull(),
    /** sha256 of the change's kind/title/before/after. */
    changeHash: t.varchar({ length: 64 }).notNull(),
    /** Null means "deliberately no image", not "not yet generated". */
    imageData: bytea("image_data"),
    imageMimeType: t.varchar("image_mime_type", { length: 50 }),
    imageWidth: t.integer("image_width"),
    imageHeight: t.integer("image_height"),
    /** The prompt used, kept so a bad batch can be explained and regenerated. */
    prompt: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueBriefChange: unique().on(table.contentBriefId, table.changeIndex),
    briefIdIndex: index("brief_change_image_brief_id_idx").on(
      table.contentBriefId,
    ),
  }),
);

export * from "./auth-schema";
