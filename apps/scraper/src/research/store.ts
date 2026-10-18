import { createHash } from "node:crypto";

import { and, desc, eq, gt, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { ResearchCache, ResearchDocument } from "@acme/db/schema";

export interface SourceDocument {
  url: string;
  title: string;
  body: string;
  sourceHash: string;
  fetchedAt: Date;
  expiresAt: Date;
}
export interface ResearchStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, expiresAt: Date): Promise<void>;
  document(url: string): Promise<SourceDocument | undefined>;
  saveDocument(document: SourceDocument): Promise<void>;
  find(query: string): Promise<SourceDocument[]>;
}
export const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex");

export const researchStore: ResearchStore = {
  async get(key) {
    const [row] = await db
      .select({ value: ResearchCache.value })
      .from(ResearchCache)
      .where(
        and(
          eq(ResearchCache.key, key),
          gt(ResearchCache.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row?.value;
  },
  async set(key, value, expiresAt) {
    await db
      .insert(ResearchCache)
      .values({ key, value, expiresAt })
      .onConflictDoUpdate({
        target: ResearchCache.key,
        set: { value, expiresAt },
      });
  },
  async document(url) {
    const [row] = await db
      .select()
      .from(ResearchDocument)
      .where(
        and(
          eq(ResearchDocument.url, url),
          gt(ResearchDocument.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(ResearchDocument.fetchedAt))
      .limit(1);
    return row;
  },
  async saveDocument(document) {
    const id = hash(JSON.stringify([document.url, document.sourceHash]));
    await db.transaction(async (tx) => {
      await tx
        .update(ResearchDocument)
        .set({ expiresAt: document.fetchedAt })
        .where(
          and(
            eq(ResearchDocument.url, document.url),
            sql`${ResearchDocument.id} <> ${id}`,
          ),
        );
      await tx
        .insert(ResearchDocument)
        .values({ ...document, id })
        .onConflictDoUpdate({ target: ResearchDocument.id, set: document });
    });
  },
  async find(query) {
    const match = sql`plainto_tsquery('english', ${query})`;
    return db
      .select()
      .from(ResearchDocument)
      .where(
        and(
          gt(ResearchDocument.expiresAt, new Date()),
          sql`${ResearchDocument.searchVector} @@ ${match}`,
        ),
      )
      .orderBy(
        desc(sql`ts_rank(${ResearchDocument.searchVector}, ${match})`),
        ResearchDocument.url,
      )
      .limit(5);
  },
};
