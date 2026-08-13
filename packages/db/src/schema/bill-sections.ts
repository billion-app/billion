import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { Bill } from "./bill.js";

// Bill source version table - stores complete raw XML and metadata
export const BillSourceVersion = pgTable(
  "bill_source_version",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    billId: t.uuid().notNull().references(() => Bill.id, { onDelete: "cascade" }),
    versionCode: t.varchar({ length: 50 }).notNull(), // e.g., "hr", "s", "ih", "rh"
    officialDate: t.timestamp({ withTimezone: true }),
    sourceUrl: t.text().notNull(),
    rawXml: t.text().notNull(), // Complete raw XML content
    sourceHash: t.varchar({ length: 64 }).notNull(), // SHA-256 hash of raw XML
    parseStatus: t.varchar({ length: 50 }).notNull().default("pending"), // "pending", "success", "failed"
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueBillVersion: unique().on(table.billId, table.versionCode, table.sourceHash),
    billIdIndex: index("bill_source_version_bill_id_idx").on(table.billId),
    sourceHashIndex: index("bill_source_version_source_hash_idx").on(table.sourceHash),
  }),
);

export const CreateBillSourceVersionSchema = createInsertSchema(BillSourceVersion).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Bill section table - stores parsed sections with structural paths
export const BillSection = pgTable(
  "bill_section",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    sourceVersionId: t.uuid().notNull().references(() => BillSourceVersion.id, { onDelete: "cascade" }),
    parentSectionId: t.uuid().references(() => BillSection.id, { onDelete: "set null" }),
    structuralPath: t.varchar({ length: 500 }).notNull(), // e.g., "title-ii/subtitle-b/section-219"
    displayNumber: t.varchar({ length: 100 }), // e.g., "219"
    heading: t.text(), // Section heading
    order: t.integer().notNull(), // Position within parent section
    text: t.text().notNull(), // Complete section text
    sectionHash: t.varchar({ length: 64 }).notNull(), // SHA-256 hash of section text
    tokenCount: t.integer(), // Number of tokens in the section text
    sourceOffsets: t.jsonb().$type<{ start: number; end: number }[]>(), // Character offsets in source XML
    xmlIds: t.jsonb().$type<string[]>(), // XML IDs referenced in this section
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    uniqueSectionPath: unique().on(table.sourceVersionId, table.structuralPath),
    sourceVersionIndex: index("bill_section_source_version_idx").on(table.sourceVersionId),
    parentSectionIndex: index("bill_section_parent_idx").on(table.parentSectionId),
    structuralPathIndex: index("bill_section_structural_path_idx").on(table.structuralPath),
    sectionHashIndex: index("bill_section_section_hash_idx").on(table.sectionHash),
  }),
);

export const CreateBillSectionSchema = createInsertSchema(BillSection).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Updated Bill table to remove fullText and add searchVector to reference sections
export const UpdatedBill = pgTable(
  "bill",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    billNumber: t.varchar({ length: 100 }).notNull(), // e.g., "H.R. 1234"
    title: t.text().notNull(),
    description: t.text(),
    sponsor: t.varchar({ length: 256 }),
    status: t.text(),
    introducedDate: t.timestamp(),
    lastActionAt: t.timestamp(),
    congress: t.integer(), // e.g., 118 for 118th Congress
    chamber: t.varchar({ length: 50 }), // "House" or "Senate"
    summary: t.text(),
    // Removed fullText field - now stored in bill_sections
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
    // Updated searchVector to index section texts instead of full text
    searchVector: t
      .tsvector("search_vector")
      .generatedAlwaysAs(
        (): SQL => sql`(
          setweight(to_tsvector('english', coalesce(bill_number, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(sponsor, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '')), 'B')
        )`,
      ),
  }),
  (table) => ({
    descriptionMaxLength: sql`check (bill_description_max_100_chars)`,
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