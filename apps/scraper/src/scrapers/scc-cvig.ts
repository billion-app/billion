/**
 * Santa Clara County Voter Information Guide (CVIG) statement scraper.
 *
 * Extracts candidate statements of qualifications (§13307) from the county's
 * official voter-guide PDFs and writes ONE CivicApiCache row per election. The
 * thin API adapter (packages/api .../scc-registrar.ts) reads that row at request
 * time and matches a candidate by name — keeping the heavy PDF work out of the
 * serverless API path.
 *
 * Source: https://stgenrov.sccgov.org/voterguide/{electionId}/{docCode}.pdf
 * These PDFs have a real text layer (no OCR needed) but a two-column layout that
 * naive extraction interleaves. We extract with positional data and split each
 * page into left/right columns before segmenting. When that yields too little,
 * we fall back to multimodal extraction (Gemini) on the raw PDF bytes.
 *
 * Discovery is a hand-maintained {year → electionId, docCodes} map for v1: the
 * blob LIST API can't enumerate recent elections and the county's lookup tools
 * are Cloudflare-gated. A future discovery script can bridge the electionId via
 * Clarity ENR (results.enr.clarityelections.com/CA/Santa_Clara) by election date
 * — see issues #100 / #102.
 */

import { generateObject } from "ai";
import { getDocumentProxy } from "unpdf";
import { z } from "zod/v4";

import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";
import {
  SCC_CVIG_ADDRESS_HASH,
  SCC_CVIG_ENDPOINT,
  sccCvigCacheParams,
} from "@acme/api/lib/candidate-sources/scc-cvig-cache";
import type {
  SccCvigPayload,
  SccCvigStatement,
} from "@acme/api/lib/candidate-sources/scc-cvig-cache";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { visionLlm } from "../utils/ai/provider.js";

const logger = createLogger("scc-cvig");

const PDF_BASE = "https://stgenrov.sccgov.org/voterguide";
const FETCH_TIMEOUT_MS = 30_000;
/** Browser UA — the stgenrov host is WAF-free but bare clients can be blocked. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
/** Cache rows live well past a single election cycle; re-runs upsert. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Below this many parsed statements per doc, fall back to multimodal extraction. */
const MIN_STATEMENTS_BEFORE_FALLBACK = 2;

/**
 * Hand-maintained discovery map. Refresh ~6 weeks before each SCC election:
 * capture the electionId (the `/voterguide/{id}/` folder) and the candidate
 * statement docCodes for the ballot types you want to cover.
 *
 * TODO(#102): replace with Clarity-ENR-based discovery (electiondate → folder).
 */
const SCC_GUIDES: Record<number, { electionId: string; docCodes: string[] }> = {
  // 2024 General — known-good sample doc (verified reachable, real text layer).
  2024: { electionId: "137", docCodes: ["SC341ENG-508"] },
  // 2026 Primary — fill in once the guide is published.
  // 2026: { electionId: "<id>", docCodes: ["<docCode>", ...] },
};

interface TextItem {
  str: string;
  x: number;
  y: number;
}

/** Fetch a PDF as bytes, or null on any failure (never throws). */
async function fetchPdf(url: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/pdf" },
    });
    if (!resp.ok) {
      logger.warn(`PDF fetch ${resp.status} for ${url}`);
      return null;
    }
    return new Uint8Array(await resp.arrayBuffer());
  } catch (err) {
    logger.warn(`PDF fetch failed for ${url}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract page text with two-column de-interleaving. SCC guides lay candidate
 * statements out in two columns; sorting items by (column, y, x) recovers the
 * natural top-to-bottom-then-next-column reading order that a plain text dump
 * scrambles.
 */
async function extractColumnAwareText(pdf: Uint8Array): Promise<string> {
  const proxy = await getDocumentProxy(pdf);
  const pages: string[] = [];

  for (let p = 1; p <= proxy.numPages; p++) {
    const page = await proxy.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const rawItems = content.items as unknown[];
    const items: TextItem[] = rawItems
      .map((it): TextItem | null => {
        const t = it as { str?: string; transform?: number[] };
        if (typeof t.str !== "string" || !t.transform) return null;
        return { str: t.str, x: t.transform[4] ?? 0, y: t.transform[5] ?? 0 };
      })
      .filter((v): v is TextItem => v !== null && v.str.trim().length > 0);

    const midX = viewport.width / 2;
    const sortColumn = (col: TextItem[]) =>
      col
        // top-to-bottom (PDF y grows upward), then left-to-right
        .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x))
        .map((i) => i.str)
        .join(" ");

    const left = sortColumn(items.filter((i) => i.x < midX));
    const right = sortColumn(items.filter((i) => i.x >= midX));
    pages.push([left, right].filter(Boolean).join("\n"));
  }

  return pages.join("\n\n");
}

/**
 * Regex-segment de-interleaved guide text into candidate statements.
 *
 * The guide flows each statement on one continuous run (column extraction does
 * not preserve line breaks):
 *   CANDIDATE STATEMENTS FOR <OFFICE>
 *   <NAME IN CAPS> Occupation: <occ> Age: <age> Education and Qualifications: <body> CS-####
 *
 * We capture the office heading, then each `<NAME> Occupation: … Education and
 * Qualifications: <body>` block, ending the body at the next candidate name, the
 * next office heading, a `CS-####` doc code, or a page footer.
 */
function segmentStatements(text: string, sourceUrl: string): SccCvigStatement[] {
  const out: SccCvigStatement[] = [];

  // Split the doc by office headings so each candidate inherits its office.
  const headingRe = /CANDIDATE STATEMENTS? FOR\s+([^\n]+?)(?=\s+[A-Z][A-Z.'' -]+\s+Occupation:)/g;
  // Within a section, a candidate block runs from a CAPS name + "Occupation:"
  // through "Education and Qualifications:" and its body, up to the next such
  // name, the next office heading, a CS-#### code, or a page footer.
  const candRe =
    /([A-Z][A-Z.'' -]{2,40}?)\s+Occupation:\s*(.*?)\s+Education and Qualifications:\s*(.*?)(?=\s+[A-Z][A-Z.'' -]{2,40}?\s+Occupation:|\s+CANDIDATE STATEMENTS? FOR|\s+CS-\d|\s+SC Ballot Type|$)/gs;

  // Build (office, startIndex) markers so we can label each candidate by office.
  const offices: { office: string; index: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(text)) !== null) {
    offices.push({ office: hm[1]?.trim() ?? "", index: hm.index });
  }
  const officeAt = (index: number): string | undefined => {
    let current: string | undefined;
    for (const o of offices) {
      if (o.index <= index) current = o.office;
      else break;
    }
    return current;
  };

  let cm: RegExpExecArray | null;
  while ((cm = candRe.exec(text)) !== null) {
    const name = cleanName(cm[1]);
    // Occupation runs up to an "Age:" marker when present.
    const occupation = cm[2]?.split(/\s+Age:/)[0]?.trim();
    const body = cm[3]?.trim().replace(/\s+/g, " ");
    if (!name || !body || body.length < 40) continue;
    const parts = [
      occupation ? `Occupation: ${occupation}` : "",
      body,
    ].filter(Boolean);
    out.push({
      name,
      office: officeAt(cm.index),
      statement: parts.join("\n\n"),
      sourceUrl,
    });
  }
  return out;
}

/**
 * Clean a captured name. Column wrapping sometimes prefixes the contest's
 * jurisdiction onto the name (e.g. an office heading "CITY CLERK, CITY OF SANTA
 * CLARA" wraps so "CITY OF SANTA CLARA" bleeds into the next candidate). Strip
 * a leading "CITY/COUNTY/TOWN OF <Place>" jurisdiction phrase. Downstream name
 * matching is fuzzy, so over-stripping is safer than leaving the prefix in.
 */
function cleanName(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(?:CITY|COUNTY|TOWN)\s+OF\s+SANTA\s+CLARA\s+/i, "")
    .replace(/^(?:CITY|COUNTY|TOWN)\s+OF\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+/, "")
    .trim();
}

const StatementSchema = z.object({
  statements: z.array(
    z.object({
      name: z.string(),
      office: z.string().optional(),
      statement: z.string(),
    }),
  ),
});

/**
 * Multimodal fallback: hand the whole PDF to Gemini and ask for structured,
 * verbatim candidate statements. Used only when text-layer segmentation comes
 * up short (e.g. a page whose columns don't split cleanly). Null when no vision
 * model is configured.
 */
async function extractWithVision(
  pdf: Uint8Array,
  sourceUrl: string,
): Promise<SccCvigStatement[] | null> {
  if (!visionLlm) {
    logger.info("No vision model configured — skipping multimodal fallback.");
    return null;
  }
  try {
    const { object } = await generateObject({
      model: visionLlm,
      schema: StatementSchema,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is an official county voter information guide. Extract every CANDIDATE STATEMENT of qualifications, VERBATIM. For each, return the candidate name, the office/contest it appears under (if shown), and the full statement text. Do NOT summarize, paraphrase, or invent — copy the statement text exactly as printed. Ignore ballot measure text, instructions, and boilerplate.",
            },
            { type: "file", data: pdf, mediaType: "application/pdf" },
          ],
        },
      ],
    });
    return object.statements
      .filter((s) => s.statement.trim().length >= 40)
      .map((s) => ({
        name: s.name.trim(),
        office: s.office?.trim() || undefined,
        statement: s.statement.trim(),
        sourceUrl,
      }));
  } catch (err) {
    logger.warn("Vision extraction failed:", err);
    return null;
  }
}

async function scrapeGuide(
  electionYear: number,
  guide: { electionId: string; docCodes: string[] },
): Promise<SccCvigStatement[]> {
  const all: SccCvigStatement[] = [];
  for (const docCode of guide.docCodes) {
    const url = `${PDF_BASE}/${guide.electionId}/${docCode}.pdf`;
    const pdf = await fetchPdf(url);
    if (!pdf) continue;

    let statements: SccCvigStatement[] = [];
    try {
      const text = await extractColumnAwareText(pdf);
      statements = segmentStatements(text, url);
      logger.info(`${docCode}: text-layer parsed ${statements.length}`);
    } catch (err) {
      logger.warn(`${docCode}: text extraction failed:`, err);
    }

    if (statements.length < MIN_STATEMENTS_BEFORE_FALLBACK) {
      const viaVision = await extractWithVision(pdf, url);
      if (viaVision && viaVision.length > statements.length) {
        logger.info(`${docCode}: vision parsed ${viaVision.length}`);
        statements = viaVision;
      }
    }
    all.push(...statements);
  }
  return all;
}

/** Merge statements, keeping the longest per candidate name (dedupe across docs). */
function dedupe(statements: SccCvigStatement[]): SccCvigStatement[] {
  const byKey = new Map<string, SccCvigStatement>();
  for (const s of statements) {
    const key = s.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = byKey.get(key);
    if (!existing || s.statement.length > existing.statement.length) {
      byKey.set(key, s);
    }
  }
  return [...byKey.values()];
}

async function scrape(): Promise<void> {
  const years = Object.keys(SCC_GUIDES).map(Number);
  if (years.length === 0) {
    logger.warn("No SCC guides configured — nothing to scrape.");
    return;
  }

  for (const year of years) {
    const guide = SCC_GUIDES[year];
    if (!guide) continue;
    logger.info(`Scraping SCC ${year} guide (election ${guide.electionId})…`);

    const statements = dedupe(await scrapeGuide(year, guide));
    if (statements.length === 0) {
      logger.warn(`SCC ${year}: no statements extracted — skipping cache write.`);
      continue;
    }

    const payload: SccCvigPayload = { statements };
    const now = new Date();
    const params = sccCvigCacheParams(year);
    try {
      await db
        .insert(CivicApiCache)
        .values({
          addressHash: SCC_CVIG_ADDRESS_HASH,
          endpoint: SCC_CVIG_ENDPOINT,
          params,
          responseData: payload,
          fetchedAt: now,
          expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
        })
        .onConflictDoUpdate({
          target: [
            CivicApiCache.addressHash,
            CivicApiCache.endpoint,
            CivicApiCache.params,
          ],
          set: {
            responseData: payload,
            fetchedAt: now,
            expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
          },
        });
      logger.success(`SCC ${year}: cached ${statements.length} statements.`);
    } catch (err) {
      logger.error(`SCC ${year}: cache write failed:`, err);
    }
  }
}

export const sccCvig: Scraper = { name: "scc-cvig", scrape };
