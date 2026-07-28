/**
 * Current-cycle Texas statewide election ingestion.
 *
 * The SOS Civix application publishes base64-wrapped JSON for election
 * discovery, contests/results, reporting status, and county totals. TLC's
 * publications page links the latest cycle-specific constitutional-amendment
 * analysis PDF. This scraper discovers both rather than constructing year URLs,
 * parses them deterministically, and stores separate provider snapshots.
 */

import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { getDocumentProxy } from "unpdf";

import type {
  TexasElectionDefinition,
  TexasSosElection,
  TexasSosSnapshotData,
  TexasTlcSnapshotData,
  TlcTextPage,
} from "@acme/api/lib/texas-election-data";
import {
  parseTexasSosDiscovery,
  parseTexasSosElection,
  parseTexasTlcAnalysis,
  TEXAS_CURRENT_SCOPE,
  TEXAS_RESULTS_URL,
  TEXAS_SOS_PROVIDER,
  TEXAS_TLC_PROVIDER,
  TEXAS_TLC_PUBLICATIONS_URL,
} from "@acme/api/lib/texas-election-data";
import { db } from "@acme/db/client";
import { ElectionSourceSnapshot } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { texasCurrentElectionConfig } from "./texas-current-election.config.js";

const logger = createLogger("texas-current-election");
const API_BASE =
  "https://goelect.txelections.civixapps.com/api-ivis-system/api/s3/enr";
const USER_AGENT =
  "Mozilla/5.0 (compatible; BillionCivicBot/1.0; +https://billion.app)";

interface TlcPublication {
  year: number;
  title: string;
  url: string;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetchWithRetry(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  return response.json() as Promise<unknown>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  return response.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetchWithRetry(url, {
    headers: { Accept: "application/pdf", "User-Agent": USER_AGENT },
    timeoutMs: 60_000,
  });
  return new Uint8Array(await response.arrayBuffer());
}

/** Discover the newest full TLC analysis PDF from the publications index. */
export function discoverLatestTlcAnalysis(
  html: string,
  baseUrl = TEXAS_TLC_PUBLICATIONS_URL,
): TlcPublication | null {
  const $ = cheerio.load(html);
  const candidates: TlcPublication[] = [];
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href || /condensed/i.test(href)) return;
    const match = /\/analyses(\d{2}|\d{4})\.pdf(?:$|[?#])/i.exec(href);
    if (!match?.[1]) return;
    const short = Number.parseInt(match[1], 10);
    const year = short < 100 ? 2000 + short : short;
    if (!Number.isInteger(year) || year > new Date().getFullYear()) return;
    candidates.push({
      year,
      title:
        $(element).text().replace(/\s+/g, " ").trim() ||
        `Analyses of Proposed Constitutional Amendments (${year})`,
      url: new URL(href, baseUrl).toString(),
    });
  });
  return candidates.sort((a, b) => b.year - a.year)[0] ?? null;
}

/** Extract each PDF page independently so citations retain real page numbers. */
export async function extractTlcPages(
  bytes: Uint8Array,
): Promise<TlcTextPage[]> {
  const pdf = await getDocumentProxy(bytes);
  const pages: TlcTextPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>)
      .map((item) => item.str?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    pages.push({ page: pageNumber, text });
  }
  return pages;
}

async function loadSosElection(
  definition: TexasElectionDefinition,
): Promise<TexasSosElection | null> {
  try {
    const [election, counties] = await Promise.all([
      fetchJson(`${API_BASE}/election/${definition.id}`),
      fetchJson(`${API_BASE}/election/countyInfo/${definition.id}`).catch(
        () => undefined,
      ),
    ]);
    return parseTexasSosElection(election, definition, counties);
  } catch (error) {
    logger.warn(`SOS election ${definition.id} could not be parsed:`, error);
    return null;
  }
}

async function upsertSnapshot(input: {
  cycleYear: number;
  provider: string;
  sourceVersion: string;
  data: Record<string, unknown>;
  diagnostics: string[];
  sourceUrls: string[];
}): Promise<void> {
  const contentHash = sha256(JSON.stringify(input.data));
  const now = new Date();
  await db
    .insert(ElectionSourceSnapshot)
    .values({
      jurisdiction: "TX",
      cycleYear: input.cycleYear,
      provider: input.provider,
      scope: TEXAS_CURRENT_SCOPE,
      sourceVersion: input.sourceVersion,
      contentHash,
      data: input.data,
      diagnostics: input.diagnostics,
      sourceUrls: input.sourceUrls,
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        ElectionSourceSnapshot.jurisdiction,
        ElectionSourceSnapshot.cycleYear,
        ElectionSourceSnapshot.provider,
        ElectionSourceSnapshot.scope,
      ],
      set: {
        sourceVersion: input.sourceVersion,
        contentHash,
        data: input.data,
        diagnostics: input.diagnostics,
        sourceUrls: input.sourceUrls,
        fetchedAt: now,
      },
    });
}

function selectedDefinitions(
  definitions: TexasElectionDefinition[],
  amendmentOnly: boolean,
  remaining: number,
): TexasElectionDefinition[] {
  const filtered = amendmentOnly
    ? definitions.filter((definition) =>
        /constitutional amendment/i.test(definition.name),
      )
    : definitions;
  return filtered.slice(0, Math.max(0, remaining));
}

async function scrape(maxItems = 12): Promise<void> {
  logger.info("Discovering current Texas SOS elections and TLC analysis…");
  const [constantsRaw, publicationsHtml] = await Promise.all([
    fetchJson(`${API_BASE}/electionConstants`),
    fetchText(TEXAS_TLC_PUBLICATIONS_URL),
  ]);
  const discovery = parseTexasSosDiscovery(constantsRaw);
  const tlcPublication = discoverLatestTlcAnalysis(publicationsHtml);
  const diagnostics: string[] = [];
  if (!tlcPublication)
    diagnostics.push("No current TLC amendment analysis PDF discovered");

  let processed = 0;
  const years = new Set([discovery.cycleYear]);
  if (tlcPublication) years.add(tlcPublication.year);
  for (const year of [...years].sort((a, b) => b - a)) {
    const definitions = selectedDefinitions(
      discovery.electionsByYear[year] ?? [],
      year !== discovery.cycleYear,
      maxItems - processed,
    );
    const elections: TexasSosElection[] = [];
    for (const definition of definitions) {
      const election = await loadSosElection(definition);
      processed++;
      if (election) elections.push(election);
    }
    if (!elections.length) {
      diagnostics.push(`No SOS election payloads parsed for ${year}`);
      continue;
    }
    const data: TexasSosSnapshotData = { cycleYear: year, elections };
    await upsertSnapshot({
      cycleYear: year,
      provider: TEXAS_SOS_PROVIDER,
      sourceVersion: elections
        .map((election) => election.sourceVersion)
        .join(","),
      data: data as unknown as Record<string, unknown>,
      diagnostics: diagnostics.filter((item) => item.includes(String(year))),
      sourceUrls: [TEXAS_RESULTS_URL],
    });
    logger.success(
      `Texas SOS ${year}: persisted ${elections.length} election(s).`,
    );
  }

  if (tlcPublication && processed < maxItems) {
    try {
      const bytes = await fetchBytes(tlcPublication.url);
      const pages = await extractTlcPages(bytes);
      const parsed: TexasTlcSnapshotData = parseTexasTlcAnalysis(
        pages,
        tlcPublication.url,
      );
      parsed.publicationTitle = tlcPublication.title;
      const tlcDiagnostics = [
        ...diagnostics.filter((item) => item.includes("TLC")),
        ...parsed.measures.flatMap((measure) =>
          measure.diagnostics.map(
            (item) => `Proposition ${measure.propositionNumber}: ${item}`,
          ),
        ),
      ];
      if (!parsed.measures.length) {
        tlcDiagnostics.push("TLC PDF contained no parseable propositions");
      }
      await upsertSnapshot({
        cycleYear: parsed.cycleYear,
        provider: TEXAS_TLC_PROVIDER,
        sourceVersion: `tlc:${parsed.cycleYear}:${sha256(bytes).slice(0, 16)}`,
        data: parsed as unknown as Record<string, unknown>,
        diagnostics: tlcDiagnostics,
        sourceUrls: [TEXAS_TLC_PUBLICATIONS_URL, tlcPublication.url],
      });
      logger.success(
        `Texas TLC ${parsed.cycleYear}: persisted ${parsed.measures.length} proposition analyses.`,
      );
    } catch (error) {
      logger.warn(
        "TLC analysis could not be parsed; SOS data remains available:",
        error,
      );
    }
  }
}

export const texasCurrentElection: Scraper = {
  ...texasCurrentElectionConfig,
  scrape: (options) =>
    scrape((options?.maxItems ?? Number(process.env.TX_SOS_MAX_ITEMS)) || 12),
};
