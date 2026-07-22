/**
 * Current-cycle NCSBE public election-data importer.
 *
 * Runtime discovery is intentionally limited to links for the current calendar
 * year. Candidate contact/address fields and all voter-history products are out
 * of scope and are never represented in the normalized parser output.
 */
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { and, eq, gte, lt, or } from "drizzle-orm";
import { getDocumentProxy } from "unpdf";

import { db } from "@acme/db/client";
import {
  ElectionCandidate,
  ElectionReferendum,
  ElectionResult,
  ElectionSource,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import type {
  NcsbeCandidateRecord,
  NcsbeReferendumRecord,
  NcsbeResultRecord,
} from "./ncsbe-parsers.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import {
  extractFirstTextFileFromZip,
  NCSBE_STRUCTURE_VERSION,
  normalizeElectionDate,
  parseCandidateCsv,
  parseReferendumLines,
  parseResultsTsv,
  restrictToCycle,
} from "./ncsbe-parsers.js";
import { ncsbeConfig } from "./ncsbe.config.js";

const logger = createLogger("ncsbe");
const CANDIDATE_LIST_URL = "https://www.ncsbe.gov/results-data/candidate-lists";
const RESULTS_LIST_URL =
  "https://www.ncsbe.gov/results-data/election-results/historical-election-results-data";
const USER_AGENT = "BillionCivicBot/1.0 (+https://billion.app)";
const BATCH_SIZE = 750;

type SourceKind = "candidates" | "referenda" | "results";
type NcsbeRecord =
  | NcsbeCandidateRecord
  | NcsbeReferendumRecord
  | NcsbeResultRecord;

export interface NcsbeSourceFile {
  kind: SourceKind;
  url: string;
  label: string;
}

function currentCycleYear(now = new Date()): number {
  return now.getUTCFullYear();
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function links(html: string, base: string): { label: string; url: string }[] {
  const $ = load(html);
  return $("a[href]")
    .toArray()
    .flatMap((anchor) => {
      const url = absoluteUrl($(anchor).attr("href") ?? "", base);
      return url
        ? [{ label: $(anchor).text().replace(/\s+/g, " ").trim(), url }]
        : [];
    });
}

/** Discover only official files whose label/path identifies the current year. */
export function discoverCurrentCycleFiles(
  candidateHtml: string,
  resultsHtml: string,
  year = currentCycleYear(),
): NcsbeSourceFile[] {
  const yearText = String(year);
  const discovered: NcsbeSourceFile[] = [];
  for (const link of links(candidateHtml, CANDIDATE_LIST_URL)) {
    const haystack = `${link.label} ${decodeURIComponent(link.url)}`;
    if (!haystack.includes(yearText)) continue;
    if (/candidate/i.test(link.label) && /\.csv(?:$|\?)/i.test(link.url)) {
      discovered.push({ kind: "candidates", ...link });
    } else if (
      /referendum/i.test(haystack) &&
      /\.pdf(?:$|\?)/i.test(link.url)
    ) {
      discovered.push({ kind: "referenda", ...link });
    }
  }
  for (const link of links(resultsHtml, RESULTS_LIST_URL)) {
    const haystack = `${link.label} ${decodeURIComponent(link.url)}`;
    if (
      haystack.includes(yearText) &&
      /results/i.test(link.label) &&
      /\.zip(?:$|\?)/i.test(link.url) &&
      !/precinct sort/i.test(link.label)
    ) {
      discovered.push({ kind: "results", ...link });
    }
  }
  return [
    ...new Map(
      discovered.map((file) => [`${file.kind}:${file.url}`, file]),
    ).values(),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || a.url.localeCompare(b.url));
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetchWithRetry(url, {
    headers: { "User-Agent": USER_AGENT },
    maxRetries: 3,
    timeoutMs: 45_000,
  });
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchPage(url: string): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url));
}

export async function extractPdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = (content.items as unknown[])
      .flatMap((raw) => {
        const item = raw as { str?: string; transform?: number[] };
        return typeof item.str === "string" && item.transform
          ? [
              {
                text: item.str.trim(),
                x: item.transform[4] ?? 0,
                y: item.transform[5] ?? 0,
              },
            ]
          : [];
      })
      .filter((item) => item.text);
    items.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));
    let activeY: number | null = null;
    let active: typeof items = [];
    const flush = () => {
      if (active.length)
        lines.push(
          active
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" "),
        );
      active = [];
    };
    for (const item of items) {
      if (activeY !== null && Math.abs(activeY - item.y) > 2) flush();
      activeY = item.y;
      active.push(item);
    }
    flush();
  }
  return lines;
}

export async function parseReferendumPdf(
  bytes: Uint8Array,
  sourceUrl: string,
): Promise<NcsbeReferendumRecord[]> {
  return parseReferendumLines(
    await extractPdfLines(bytes),
    sourceDateFromUrl(sourceUrl) ?? undefined,
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sourceDateFromUrl(url: string): string | null {
  const compact = /(?:_|referendums_)(20\d{2})(\d{2})(\d{2})/.exec(url);
  return compact
    ? normalizeElectionDate(`${compact[2]}/${compact[3]}/${compact[1]}`)
    : null;
}

function groupsByDate<T extends { electionDate: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows)
    groups.set(row.electionDate, [
      ...(groups.get(row.electionDate) ?? []),
      row,
    ]);
  return groups;
}

async function insertBatches<T>(
  rows: readonly T[],
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    await insert(rows.slice(start, start + BATCH_SIZE));
  }
}

async function persistDateGroup(
  file: NcsbeSourceFile,
  electionDate: string,
  checksum: string,
  fetchedAt: Date,
  rows: NcsbeRecord[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const [cached] = await tx
      .select({
        id: ElectionSource.id,
        checksum: ElectionSource.checksum,
        structureVersion: ElectionSource.structureVersion,
      })
      .from(ElectionSource)
      .where(
        and(
          eq(ElectionSource.provider, "ncsbe"),
          eq(ElectionSource.sourceKind, file.kind),
          eq(ElectionSource.electionDate, electionDate),
          eq(ElectionSource.sourceUrl, file.url),
        ),
      )
      .limit(1);
    if (
      cached?.checksum === checksum &&
      cached.structureVersion === NCSBE_STRUCTURE_VERSION
    ) {
      await tx
        .update(ElectionSource)
        .set({ fetchedAt })
        .where(eq(ElectionSource.id, cached.id));
      return;
    }

    const [source] = await tx
      .insert(ElectionSource)
      .values({
        provider: "ncsbe",
        sourceKind: file.kind,
        electionDate,
        sourceUrl: file.url,
        checksum,
        structureVersion: NCSBE_STRUCTURE_VERSION,
        certificationStatus:
          file.kind === "results" ? "official_not_certified" : "not_applicable",
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: [
          ElectionSource.provider,
          ElectionSource.sourceKind,
          ElectionSource.electionDate,
          ElectionSource.sourceUrl,
        ],
        set: { checksum, structureVersion: NCSBE_STRUCTURE_VERSION, fetchedAt },
      })
      .returning({ id: ElectionSource.id });
    if (!source) throw new Error(`Unable to upsert source ${file.url}`);

    if (file.kind === "candidates") {
      await tx
        .delete(ElectionCandidate)
        .where(eq(ElectionCandidate.sourceId, source.id));
      const candidates = rows as NcsbeCandidateRecord[];
      await insertBatches(candidates, (batch) =>
        tx
          .insert(ElectionCandidate)
          .values(batch.map((row) => ({ ...row, sourceId: source.id }))),
      );
    } else if (file.kind === "referenda") {
      await tx
        .delete(ElectionReferendum)
        .where(eq(ElectionReferendum.sourceId, source.id));
      const referenda = rows as NcsbeReferendumRecord[];
      await insertBatches(referenda, (batch) =>
        tx
          .insert(ElectionReferendum)
          .values(batch.map((row) => ({ ...row, sourceId: source.id }))),
      );
    } else {
      await tx
        .delete(ElectionResult)
        .where(eq(ElectionResult.sourceId, source.id));
      const results = rows as NcsbeResultRecord[];
      await insertBatches(results, (batch) =>
        tx
          .insert(ElectionResult)
          .values(batch.map((row) => ({ ...row, sourceId: source.id }))),
      );
    }
  });
}

async function importFile(
  file: NcsbeSourceFile,
  year: number,
): Promise<number> {
  const fetchedAt = new Date();
  const bytes = await fetchBytes(file.url);
  const checksum = sha256(bytes);
  let rows: NcsbeRecord[];
  if (file.kind === "candidates") {
    rows = parseCandidateCsv(new TextDecoder().decode(bytes));
  } else if (file.kind === "results") {
    rows = parseResultsTsv(extractFirstTextFileFromZip(bytes));
  } else {
    rows = await parseReferendumPdf(bytes, file.url);
  }
  rows = restrictToCycle<NcsbeRecord>(rows, year);
  if (rows.length === 0)
    throw new Error(`${file.url} produced no current-cycle records`);
  for (const [electionDate, dateRows] of groupsByDate(rows)) {
    await persistDateGroup(file, electionDate, checksum, fetchedAt, dateRows);
  }
  return rows.length;
}

export async function scrapeNcsbe(
  maxItems = 4,
  now = new Date(),
): Promise<void> {
  const year = currentCycleYear(now);
  logger.info(`Discovering NCSBE public election files for the ${year} cycle…`);
  const [candidateHtml, resultsHtml] = await Promise.all([
    fetchPage(CANDIDATE_LIST_URL),
    fetchPage(RESULTS_LIST_URL),
  ]);
  const files = discoverCurrentCycleFiles(
    candidateHtml,
    resultsHtml,
    year,
  ).slice(0, maxItems);
  if (files.length === 0)
    throw new Error(`No NCSBE files discovered for ${year}`);
  for (const file of files) {
    const count = await importFile(file, year);
    logger.success(`${file.kind}: persisted ${count} records from ${file.url}`);
  }
  // Keep persistence bounded to the product's current-cycle scope. Cascading
  // foreign keys remove normalized rows only after every current import succeeds.
  const stale = await db
    .delete(ElectionSource)
    .where(
      and(
        eq(ElectionSource.provider, "ncsbe"),
        or(
          lt(ElectionSource.electionDate, `${year}-01-01`),
          gte(ElectionSource.electionDate, `${year + 1}-01-01`),
        ),
      ),
    )
    .returning({ id: ElectionSource.id });
  if (stale.length)
    logger.info(`Removed ${stale.length} out-of-cycle NCSBE source snapshots.`);
}

export const ncsbe: Scraper = {
  ...ncsbeConfig,
  scrape: (options) =>
    scrapeNcsbe(
      (options?.maxItems ?? Number(process.env.NCSBE_MAX_ITEMS)) || 4,
    ),
};
