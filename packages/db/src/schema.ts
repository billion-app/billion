import { sql } from "drizzle-orm";
import { customType, index, pgTable, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

// Bills table for congressional legislation
export const Bill = pgTable(
  "bill",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    billNumber: t.varchar({ length: 100 }).notNull(), // e.g., "H.R. 1234"
    title: t.text().notNull(),
    description: t.text(),
    sponsor: t.varchar({ length: 256 }),
    status: t.varchar({ length: 100 }), // e.g., "Introduced", "Passed House", etc.
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
      .$type<{ date: string; text: string; type?: string }[]>()
      .default([]),
    url: t.text().notNull(),
    sourceWebsite: t.varchar({ length: 50 }).notNull(), // "congress.gov"
    contentHash: t.varchar({ length: 64 }).notNull().default(""), // SHA-256 hash for version tracking
    versions: t
      .jsonb()
      .$type<{ hash: string; updatedAt: string; changes: string }[]>()
      .default([]), // Version history
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueBillNumberSource: unique().on(table.billNumber, table.sourceWebsite),
  }),
);

export const CreateBillSchema = createInsertSchema(Bill).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Government Content table (executive orders, memoranda, proclamations, news articles, briefings, etc.)
export const GovernmentContent = pgTable("government_content", (t) => ({
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
    .$type<{ url: string; alt: string; source: string; sourceUrl: string }[]>()
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
}));

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
  }),
  (table) => ({
    uniqueCaseNumber: unique().on(table.caseNumber),
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
    title: t.varchar({ length: 25 }).notNull(), // Max 25 chars
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

// User-submitted feedback
export const Feedback = pgTable(
  "feedback",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull(),
    category: t.varchar({ length: 20 }).notNull(), // "bug" | "idea" | "content"
    message: t.text().notNull(),
    os: t.varchar({ length: 20 }), // device OS, e.g. "ios" | "android"
    appVersion: t.varchar({ length: 20 }),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    userIdx: index("feedback_user_id_idx").on(table.userId),
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
    uniqueCacheKey: unique().on(table.addressHash, table.endpoint, table.params),
    expiresAtIdx: index("civic_cache_expires_idx").on(table.expiresAt),
  }),
);

export * from "./auth-schema";
