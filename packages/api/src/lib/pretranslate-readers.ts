/** Prepare full Chinese readers without waiting for a person to open them. */
import { asc, gt, sql, unionAll } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CourtCase, GovernmentContent } from "@acme/db/schema";

import { loadContentDetail } from "./content-detail";
import { readerTranslationSource } from "./content-translation";
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

/** Keyset walk also catches later brief/lens refreshes and older saved articles. */
export async function prepareReaderTranslationPage(input: {
  after?: string;
  limit: number;
}) {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new Error("Reader preparation limit must be 1–100");
  const records = unionAll(
    db.select({ id: Bill.id }).from(Bill),
    db.select({ id: GovernmentContent.id }).from(GovernmentContent),
    db.select({ id: CourtCase.id }).from(CourtCase),
  ).as("readers");
  const rows = await db
    .select()
    .from(records)
    .where(input.after ? gt(records.id, input.after) : undefined)
    .orderBy(asc(records.id))
    .limit(input.limit);
  let ready = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (await prepareReaderTranslation(row.id)) ready++;
    } catch {
      // A deleted or malformed record must not prevent the archive walk.
      // It is retried on the next sweep; do not log source text or credentials.
      failed++;
    }
  }
  return {
    scanned: rows.length,
    ready,
    failed,
    queued: rows.length - ready - failed,
    after: rows.at(-1)?.id,
    complete: rows.length < input.limit,
  };
}

export async function readerPreparationHasCapacity() {
  const result = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from content_translation_request
  `);
  // Leave the worker available for interactive requests; do not enqueue the
  // whole archive in front of someone who just opened an uncached article.
  return (result.rows[0]?.count ?? 0) < 20;
}
