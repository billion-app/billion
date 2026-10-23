/** Prepare full Chinese readers without waiting for a person to open them. */
import { and, asc, eq, gt, sql, unionAll } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  ContentBrief,
  ContentLens,
  ContentTranslation,
  CourtCase,
  GovernmentContent,
} from "@acme/db/schema";

import { loadContentDetail } from "./content-detail";
import {
  readerTranslationSource,
  TRANSLATION_PROMPT_VERSION,
} from "./content-translation";
import { getTranslations } from "./content-translation-store";

export async function prepareReaderTranslation(id: string) {
  const detail = await loadContentDetail({
    id,
    supportsMassachusetts: true,
    translationOnly: true,
  });
  return !!(await getTranslations({
    contentId: detail.id,
    contentType: detail.type,
    language: "zh",
    source: readerTranslationSource(detail),
  }));
}

interface PreparationPage {
  after?: string;
  limit: number;
}
type ReaderContentType = Parameters<typeof getTranslations>[0]["contentType"];

async function readerRevisionPage(input: PreparationPage) {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new Error("Reader preparation limit must be 1–100");
  const records = unionAll(
    db
      .select({
        id: Bill.id,
        type: sql<ReaderContentType>`'bill'`.as("type"),
        revision: sql<string>`${Bill}.xmin::text`.as("revision"),
      })
      .from(Bill),
    db
      .select({
        id: GovernmentContent.id,
        type: sql<ReaderContentType>`'government_content'`.as("type"),
        revision: sql<string>`${GovernmentContent}.xmin::text`.as("revision"),
      })
      .from(GovernmentContent),
    db
      .select({
        id: CourtCase.id,
        type: sql<ReaderContentType>`'court_case'`.as("type"),
        revision: sql<string>`${CourtCase}.xmin::text`.as("revision"),
      })
      .from(CourtCase),
  ).as("readers");
  return db
    .select({
      id: records.id,
      type: records.type,
      sourceRevision: records.revision,
      briefId: ContentBrief.id,
      briefRevision: sql<string | null>`${ContentBrief}.xmin::text`,
      lensId: ContentLens.id,
      lensRevision: sql<string | null>`${ContentLens}.xmin::text`,
      translationId: ContentTranslation.id,
      translationRevision: sql<string | null>`${ContentTranslation}.xmin::text`,
    })
    .from(records)
    .leftJoin(
      ContentBrief,
      and(
        eq(ContentBrief.contentId, records.id),
        eq(ContentBrief.contentType, records.type),
      ),
    )
    .leftJoin(
      ContentLens,
      and(
        eq(ContentLens.contentId, records.id),
        eq(ContentLens.contentType, records.type),
      ),
    )
    .leftJoin(
      ContentTranslation,
      and(
        eq(ContentTranslation.contentId, records.id),
        eq(ContentTranslation.contentType, records.type),
        eq(ContentTranslation.language, "zh"),
      ),
    )
    .where(input.after ? gt(records.id, input.after) : undefined)
    .orderBy(asc(records.id))
    .limit(input.limit);
}

/** One worker owns this cache and walks pages in keyset order. */
export function createReaderTranslationPreparer(now = Date.now) {
  const readyRevisions = new Map<
    string,
    { revision: string; checkedAt: number }
  >();
  let seen: Set<string> | undefined;
  return async function preparePage(input: PreparationPage) {
    const rows = await readerRevisionPage(input);
    if (!input.after) {
      seen = new Set();
    }
    let ready = 0;
    let failed = 0;
    let queued = 0;
    let skipped = 0;
    for (const row of rows) {
      seen?.add(row.id);
      // xmin catches raw SQL writes that leave application timestamps unchanged.
      const revision = JSON.stringify([TRANSLATION_PROMPT_VERSION, row]);
      const checkedAt = now();
      const cached = readyRevisions.get(row.id);
      // A daily full check bounds revision reuse, including transaction ID wraparound.
      if (
        cached?.revision === revision &&
        checkedAt - cached.checkedAt < 86_400_000
      ) {
        skipped++;
        continue;
      }
      readyRevisions.delete(row.id);
      try {
        if (await prepareReaderTranslation(row.id)) {
          ready++;
          // Keep the revision observed before preparation so concurrent edits recheck.
          readyRevisions.set(row.id, { revision, checkedAt });
        } else queued++;
      } catch {
        // Deleted or malformed records retry on the next sweep.
        failed++;
      }
    }
    const complete = rows.length < input.limit;
    if (complete && seen) {
      for (const id of readyRevisions.keys()) {
        if (!seen.has(id)) readyRevisions.delete(id);
      }
      seen = undefined;
    }
    return {
      scanned: rows.length,
      ready,
      failed,
      queued,
      skipped,
      after: rows.at(-1)?.id,
      complete,
    };
  };
}

/** Explicit one-off preparation always validates the current full reader. */
export function prepareReaderTranslationPage(input: PreparationPage) {
  return createReaderTranslationPreparer()(input);
}

export async function readerPreparationHasCapacity() {
  const result = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from content_translation_request
    where available_at <= now() or claim_id is not null
  `);
  // Backoff jobs must not permanently stop the archive walk.
  // Leave the worker available for interactive requests; do not enqueue the
  // whole archive in front of someone who just opened an uncached article.
  return (result.rows[0]?.count ?? 0) < 20;
}
