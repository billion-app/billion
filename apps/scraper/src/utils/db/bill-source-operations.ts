import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { BillSection, BillSourceVersion } from "@acme/db/schema";

import type { BillSourceVersionInput } from "../bill-sections.js";
import { parseBillSections } from "../bill-sections.js";

/**
 * Retain immutable official versions and parse each source hash once.
 * Re-fetching byte-identical XML is a database no-op.
 */
export async function persistBillSourceVersions(
  billId: string,
  versions: readonly BillSourceVersionInput[],
): Promise<void> {
  for (const version of versions) {
    const [inserted] = await db
      .insert(BillSourceVersion)
      .values({ billId, ...version })
      .onConflictDoNothing({
        target: [
          BillSourceVersion.billId,
          BillSourceVersion.versionCode,
          BillSourceVersion.sourceHash,
        ],
      })
      .returning({
        id: BillSourceVersion.id,
        parseStatus: BillSourceVersion.parseStatus,
      });

    const sourceVersion =
      inserted ??
      (
        await db
          .select({
            id: BillSourceVersion.id,
            parseStatus: BillSourceVersion.parseStatus,
          })
          .from(BillSourceVersion)
          .where(
            and(
              eq(BillSourceVersion.billId, billId),
              eq(BillSourceVersion.versionCode, version.versionCode),
              eq(BillSourceVersion.sourceHash, version.sourceHash),
            ),
          )
          .limit(1)
      )[0];

    if (!sourceVersion || sourceVersion.parseStatus === "parsed") continue;

    try {
      const sections = parseBillSections(version.rawXml);
      await db.transaction(async (tx) => {
        await tx
          .delete(BillSection)
          .where(eq(BillSection.sourceVersionId, sourceVersion.id));
        if (sections.length > 0) {
          await tx.insert(BillSection).values(
            sections.map((section) => ({
              sourceVersionId: sourceVersion.id,
              ...section,
            })),
          );
        }
        await tx
          .update(BillSourceVersion)
          .set({
            parseStatus: "parsed",
            parseError: null,
            updatedAt: new Date(),
          })
          .where(eq(BillSourceVersion.id, sourceVersion.id));
      });
    } catch (error) {
      await db
        .update(BillSourceVersion)
        .set({
          parseStatus: "failed",
          parseError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(BillSourceVersion.id, sourceVersion.id));
      throw error;
    }
  }
}
