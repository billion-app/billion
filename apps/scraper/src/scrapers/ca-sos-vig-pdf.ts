/**
 * Fallback reader for the California SOS Voter Information Guide PDF.
 *
 * The candidate HTML pages are protected by Imperva/CloudFront and reject
 * server-side clients. The official PDF is served from a separate CDN and
 * contains the same statewide candidate statements.
 */

import { getDocumentProxy } from "unpdf";

import type { CaSosStatement } from "@acme/api/lib/candidate-sources/ca-sos-cache";

import { createLogger } from "../utils/log.js";

const logger = createLogger("ca-sos-statements");

const GUIDE_INDEX_URL =
  "https://www.sos.ca.gov/elections/voting-resources/voter-information-guides";
const GUIDE_CDN_BASE = "https://vig.cdn.sos.ca.gov";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_STATEMENT_CHARS = 2500;

const PARTY_NAMES = new Set([
  "AMERICAN INDEPENDENT",
  "DEMOCRATIC",
  "GREEN",
  "LIBERTARIAN",
  "NO PARTY PREFERENCE",
  "NO QUALIFIED PARTY PREFERENCE",
  "PEACE AND FREEDOM",
  "REPUBLICAN",
]);

const OFFICE_HEADERS: { match: string; slug: string }[] = [
  { match: "SUPERINTENDENT OF PUBLIC INSTRUCTION", slug: "superintendent" },
  { match: "LIEUTENANT GOVERNOR", slug: "lt-governor" },
  { match: "INSURANCE COMMISSIONER", slug: "insurance-commissioner" },
  { match: "ATTORNEY GENERAL", slug: "attorney-general" },
  { match: "SECRETARY OF STATE", slug: "sos" },
  { match: "BOARD OF EQUALIZATION", slug: "boe" },
  { match: "CONTROLLER", slug: "controller" },
  { match: "TREASURER", slug: "treasurer" },
  { match: "GOVERNOR", slug: "governor" },
];

interface PdfItem {
  str?: string;
  height?: number;
}

function textOf(item: PdfItem | undefined): string {
  return (item?.str ?? "").replace(/\s+/g, " ").trim();
}

function clamp(text: string): string {
  return text.length > MAX_STATEMENT_CHARS
    ? text.slice(0, MAX_STATEMENT_CHARS).trimEnd()
    : text;
}

function findOfficeSlug(items: PdfItem[]): string | null {
  const header = items
    .slice(0, 5)
    .map(textOf)
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  return (
    OFFICE_HEADERS.find(({ match }) => header.includes(match))?.slug ?? null
  );
}

function isCandidateStart(
  items: PdfItem[],
  index: number,
  slug: string,
): boolean {
  const name = textOf(items[index]);
  const height = items[index]?.height ?? 0;
  if (!name || height < 14 || height > 20) return false;
  if (name === "CANDIDATE STATEMENTS" || name === "GOVERNOR") return false;

  const next = textOf(items[index + 1]);
  const party = textOf(items[index + 2]);
  if (next === "|" && PARTY_NAMES.has(party)) return true;

  // The Superintendent contest is nonpartisan, so its candidate headings do
  // not have the pipe/party line used by the other statewide offices.
  return slug === "superintendent";
}

function extractEmail(text: string): string | undefined {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.exec(text)?.[0];
}

function extractPhone(text: string): string | undefined {
  const raw = /\b(?:Tel|Telephone)\s*:\s*([+\d().\-\s]{7,})/i
    .exec(text)?.[1]
    ?.trim();
  return raw && (raw.match(/\d/g)?.length ?? 0) >= 7 ? raw : undefined;
}

function extractWebsite(text: string): string | undefined {
  const raw =
    /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*\.(?:com|org|net|vote|us)(?:\/[^\s,]*)?)\b/i.exec(
      text,
    )?.[1];
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function parsePage(
  items: PdfItem[],
  slug: string,
  sourceUrl: string,
): CaSosStatement[] {
  const starts: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (isCandidateStart(items, i, slug)) starts.push(i);
  }

  return starts.flatMap((start, offset) => {
    const name = textOf(items[start]);
    const partyLine = textOf(items[start + 1]) === "|";
    const bodyStart = start + (partyLine ? 3 : 1);
    const bodyEnd = starts[offset + 1] ?? items.length;
    const body = items
      .slice(bodyStart, bodyEnd)
      .map(textOf)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) return [];

    const contactStart = body.search(
      /\b(?:PO Box|Tel(?:ephone)?\s*:|E-?mail\s*:|Facebook\s*:|Instagram\s*:|X\s*:)/i,
    );
    const statement = clamp(
      (contactStart > 0 ? body.slice(0, contactStart) : body).trim(),
    );
    if (statement.length < 40) return [];

    const contact = contactStart > 0 ? body.slice(contactStart) : "";
    return [
      {
        name,
        officeSlug: slug,
        statement,
        sourceUrl,
        website: extractWebsite(statement),
        email: extractEmail(contact),
        phone: extractPhone(contact),
      },
    ];
  });
}

/** Parse official VIG PDF bytes into the shared SOS statement shape. */
export async function parseVigPdf(
  bytes: Uint8Array,
  sourceUrl: string,
  allowedSlugs?: Set<string>,
): Promise<CaSosStatement[]> {
  const pdf = await getDocumentProxy(bytes);
  const statements: CaSosStatement[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = (content.items as PdfItem[]).filter((item) => textOf(item));
    const slug = findOfficeSlug(items);
    if (!slug || (allowedSlugs && !allowedSlugs.has(slug))) continue;
    statements.push(...parsePage(items, slug, sourceUrl));
  }

  // A candidate can appear on a page boundary in future guide layouts. Keep
  // the longest extraction for each office/name pair.
  const byKey = new Map<string, CaSosStatement>();
  for (const statement of statements) {
    const key = `${statement.officeSlug}:${statement.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}`;
    const existing = byKey.get(key);
    if (!existing || statement.statement.length > existing.statement.length) {
      byKey.set(key, statement);
    }
  }
  return [...byKey.values()];
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/pdf",
        "User-Agent":
          "Mozilla/5.0 (compatible; BillionCivicBot/1.0; +https://billion.app)",
      },
    });
    if (!response.ok) {
      logger.warn(`VIG PDF fetch returned HTTP ${response.status}.`);
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    logger.warn("VIG PDF fetch failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Discover and fetch the current year's official VIG PDF from SOS's CDN. */
export async function fetchVigPdf(
  electionYear: number,
  allowedSlugs?: Set<string>,
): Promise<CaSosStatement[]> {
  const index = await fetchBytesAsText(GUIDE_INDEX_URL);
  if (!index) return [];

  const archivePath = new RegExp(
    `https?:\\/\\/vigarchive\\.sos\\.ca\\.gov\\/${electionYear}\\/([^/"']+)\\/?`,
    "i",
  ).exec(index)?.[1];
  if (!archivePath) {
    logger.warn(`No official VIG archive link found for ${electionYear}.`);
    return [];
  }

  const sourceUrl = `${GUIDE_CDN_BASE}/${electionYear}/${archivePath}/pdf/complete-vig.pdf`;
  const bytes = await fetchBytes(sourceUrl);
  if (!bytes) return [];

  try {
    return await parseVigPdf(bytes, sourceUrl, allowedSlugs);
  } catch (error) {
    logger.warn("VIG PDF parse failed:", error);
    return [];
  }
}

async function fetchBytesAsText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (compatible; BillionCivicBot/1.0; +https://billion.app)",
      },
    });
    if (!response.ok) {
      logger.warn(`VIG index fetch returned HTTP ${response.status}.`);
      return null;
    }
    return await response.text();
  } catch (error) {
    logger.warn("VIG index fetch failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
