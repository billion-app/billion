import type { BillAnalysisStatus, BillSectionNotes } from "@acme/validators";
import { and, asc, desc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BillSection,
  BillSectionAnalysis,
  BillSourceVersion,
} from "@acme/db/schema";
import {
  BILL_ANALYSIS_SCHEMA_VERSION,
  BillSectionNotesSchema,
} from "@acme/validators";

import type { BillSectionForAnalysis } from "../ai/bill-section-analysis.js";
import {
  analyzeBillSection,
  BILL_ANALYSIS_PROMPT_VERSION,
} from "../ai/bill-section-analysis.js";
import { getTextModelVersion } from "../ai/provider.js";
import { AIRateLimitError } from "../ai/text-generation.js";

export const BILL_ANALYSIS_CACHE_PROMPT_VERSION = `${BILL_ANALYSIS_SCHEMA_VERSION}:${BILL_ANALYSIS_PROMPT_VERSION}`;

export interface CompletedBillSectionAnalysis {
  section: BillSectionForAnalysis;
  status: BillAnalysisStatus;
  notes: BillSectionNotes | null;
  error: string | null;
}

/**
 * Analyze sections that have not been stored yet.
 *
 * New bills build every required reader-facing asset before their first
 * database write. This path lets the brief's analysis pass participate in that
 * assembly while the persisted path below continues to provide caching for
 * existing bills.
 */
export async function analyzeBillSectionsInMemory(
  sections: readonly BillSectionForAnalysis[],
): Promise<CompletedBillSectionAnalysis[]> {
  const completed: CompletedBillSectionAnalysis[] = [];

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index]!;
    if (!section.text.trim()) {
      completed.push({
        section,
        status: "skipped",
        notes: null,
        error: "Empty canonical section",
      });
      continue;
    }

    try {
      completed.push({
        section,
        status: "analyzed",
        notes: await analyzeBillSection(section),
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      completed.push({
        section,
        status: "failed",
        notes: null,
        error: message,
      });

      if (error instanceof AIRateLimitError) {
        completed.push(
          ...sections.slice(index + 1).map((remaining) => ({
            section: remaining,
            status: "failed" as const,
            notes: null,
            error: "Not analyzed because the provider rate limit was reached",
          })),
        );
        throw error;
      }
    }
  }

  return completed;
}

async function currentSections(
  billId: string,
): Promise<BillSectionForAnalysis[]> {
  const [sourceVersion] = await db
    .select({
      id: BillSourceVersion.id,
      parseStatus: BillSourceVersion.parseStatus,
    })
    .from(BillSourceVersion)
    .where(eq(BillSourceVersion.billId, billId))
    .orderBy(
      sql`${BillSourceVersion.officialDate} desc nulls last`,
      desc(BillSourceVersion.createdAt),
    )
    .limit(1);
  if (!sourceVersion || sourceVersion.parseStatus !== "parsed") return [];

  return db
    .select({
      id: BillSection.id,
      structuralPath: BillSection.structuralPath,
      heading: BillSection.heading,
      displayedNumber: BillSection.displayedNumber,
      order: BillSection.order,
      text: BillSection.text,
      sectionHash: BillSection.sectionHash,
      sourceStartOffset: BillSection.sourceStartOffset,
      sourceEndOffset: BillSection.sourceEndOffset,
    })
    .from(BillSection)
    .where(eq(BillSection.sourceVersionId, sourceVersion.id))
    .orderBy(asc(BillSection.order));
}

async function storeTerminalState(args: {
  section: BillSectionForAnalysis;
  modelVersion: string;
  status: BillAnalysisStatus;
  notes: BillSectionNotes | null;
  error: string | null;
}) {
  await db
    .insert(BillSectionAnalysis)
    .values({
      sectionId: args.section.id,
      sectionHash: args.section.sectionHash,
      promptVersion: BILL_ANALYSIS_CACHE_PROMPT_VERSION,
      modelVersion: args.modelVersion,
      status: args.status,
      notes: args.notes,
      error: args.error,
    })
    .onConflictDoUpdate({
      target: [
        BillSectionAnalysis.sectionId,
        BillSectionAnalysis.promptVersion,
        BillSectionAnalysis.modelVersion,
      ],
      set: {
        sectionHash: args.section.sectionHash,
        status: args.status,
        notes: args.notes,
        error: args.error,
        updatedAt: new Date(),
      },
    });
}

/**
 * Attach pre-commit analysis results to the canonical sections created for a
 * new bill. Structural path plus content hash is stable across the in-memory
 * parse and the subsequent persisted parse.
 */
export async function persistCompletedBillSectionAnalyses(
  billId: string,
  analyses: readonly CompletedBillSectionAnalysis[],
): Promise<void> {
  const sections = await currentSections(billId);
  const byIdentity = new Map(
    sections.map((section) => [
      `${section.structuralPath}\0${section.sectionHash}`,
      section,
    ]),
  );
  const modelVersion = getTextModelVersion();

  for (const analysis of analyses) {
    const section = byIdentity.get(
      `${analysis.section.structuralPath}\0${analysis.section.sectionHash}`,
    );
    if (!section) continue;
    await storeTerminalState({ ...analysis, section, modelVersion });
  }
}

function usableCachedNotes(value: unknown): BillSectionNotes | null {
  const parsed = BillSectionNotesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Analyze the operative source version section by section.
 *
 * Every canonical section receives a terminal-state row. Reusable analyzed or
 * skipped results are copied from any identical section hash produced by the
 * same prompt/model tuple; failed rows are recorded but retried on a later run.
 */
export async function analyzeCurrentBillSections(
  billId: string,
): Promise<CompletedBillSectionAnalysis[]> {
  const sections = await currentSections(billId);
  if (sections.length === 0) return [];

  const modelVersion = getTextModelVersion();
  const completed: CompletedBillSectionAnalysis[] = [];

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index]!;
    const [cached] = await db
      .select({
        status: BillSectionAnalysis.status,
        notes: BillSectionAnalysis.notes,
        error: BillSectionAnalysis.error,
      })
      .from(BillSectionAnalysis)
      .where(
        and(
          eq(BillSectionAnalysis.sectionHash, section.sectionHash),
          eq(
            BillSectionAnalysis.promptVersion,
            BILL_ANALYSIS_CACHE_PROMPT_VERSION,
          ),
          eq(BillSectionAnalysis.modelVersion, modelVersion),
          sql`${BillSectionAnalysis.status} in ('analyzed', 'skipped')`,
        ),
      )
      .orderBy(desc(BillSectionAnalysis.updatedAt))
      .limit(1);

    const cachedStatus: "analyzed" | "skipped" | null =
      cached?.status === "analyzed" || cached?.status === "skipped"
        ? cached.status
        : null;
    const cachedNotes =
      cached && cachedStatus === "analyzed"
        ? usableCachedNotes(cached.notes)
        : null;
    if (cached && (cachedStatus === "skipped" || cachedNotes)) {
      const result: CompletedBillSectionAnalysis = {
        section,
        status: cachedStatus ?? "analyzed",
        notes: cachedNotes,
        error: cached.error,
      };
      await storeTerminalState({ ...result, modelVersion });
      completed.push(result);
      continue;
    }

    if (!section.text.trim()) {
      const result: CompletedBillSectionAnalysis = {
        section,
        status: "skipped",
        notes: null,
        error: "Empty canonical section",
      };
      await storeTerminalState({ ...result, modelVersion });
      completed.push(result);
      continue;
    }

    try {
      const notes = await analyzeBillSection(section);
      const result: CompletedBillSectionAnalysis = {
        section,
        status: "analyzed",
        notes,
        error: null,
      };
      await storeTerminalState({ ...result, modelVersion });
      completed.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: CompletedBillSectionAnalysis = {
        section,
        status: "failed",
        notes: null,
        error: message,
      };
      await storeTerminalState({ ...result, modelVersion });
      completed.push(result);

      if (error instanceof AIRateLimitError) {
        for (const remaining of sections.slice(index + 1)) {
          const deferred: CompletedBillSectionAnalysis = {
            section: remaining,
            status: "failed",
            notes: null,
            error: "Not analyzed because the provider rate limit was reached",
          };
          await storeTerminalState({ ...deferred, modelVersion });
          completed.push(deferred);
        }
        throw error;
      }
    }
  }

  return completed;
}
