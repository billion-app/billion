/** Florida DOS constitutional initiatives cache adapter and pure HTML parsers. */
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import { decodeEntities, htmlToText } from "./html";
import type { MeasureSourceData } from "./types";

export const FL_DOS_ROOT = "https://constitutionalinitiatives.dos.fl.gov";
export const FL_DOS_ADDRESS_HASH = "__global__";
export const FL_DOS_ENDPOINT = "fl-dos-initiatives-v1";
export const FL_DOS_SOURCE_NAME = "Florida Division of Elections";

export interface FlDosSearchResult {
  electionYear: number;
  status: string;
  date?: string;
  title: string;
  serialNumber?: string;
  sponsor?: string;
  detailUrl: string;
  account: string;
  seqnum: string;
}

export interface FlDosInitiative extends FlDosSearchResult {
  reference?: string;
  summary?: string;
  ballotNumber?: number;
  madeBallot: boolean;
  fullTextUrl?: string;
  fullText?: string;
  approvalDate?: string;
  undueBurdenDate?: string;
  lastMadeReviewDate?: string;
  attorneyGeneralDate?: string;
  sentToSupremeCourtDate?: string;
  supremeCourtRuling?: string;
  supremeCourtRulingDate?: string;
  financialImpactStatementDate?: string;
  financialImpactStatementApprovalDate?: string;
  madeBallotDate?: string;
  signaturesNeededForReview?: number;
  signaturesNeededForBallot?: number;
  signaturesCurrentlyValid?: number;
}

export interface FlDosPayload {
  sourceVersion: 1;
  initiatives: FlDosInitiative[];
}

export function flDosCacheParams(year: number): string {
  return JSON.stringify({ year });
}

export function resolveFlDosUrl(href: string, base = FL_DOS_ROOT): string {
  try {
    return new URL(decodeEntities(href), base).toString();
  } catch {
    return href;
  }
}

function clean(value: string | undefined): string | undefined {
  const text = value ? htmlToText(value).replace(/\s+/g, " ").trim() : "";
  return text || undefined;
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}=["']([^"']*)["']`, "i").exec(tag)?.[1];
}

function parseDetailKey(url: string): { account: string; seqnum: string } | null {
  try {
    const parsed = new URL(url);
    const account = parsed.searchParams.get("account");
    const seqnum = parsed.searchParams.get("seqnum");
    return account && seqnum ? { account, seqnum } : null;
  } catch {
    return null;
  }
}

/** Parse years offered by the search form. */
export function parseFlDosYears(html: string): number[] {
  const select = /<select[^>]+name=["']Year["'][^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1] ?? "";
  return [...select.matchAll(/<option[^>]+value=["'](\d{4})["']/gi)]
    .map((m) => Number(m[1]))
    .filter(Number.isFinite);
}

/** Parse result rows without depending on CSS class names. */
export function parseFlDosSearchResults(html: string): FlDosSearchResult[] {
  const out: FlDosSearchResult[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (cells.length < 6) continue;
    const year = Number(clean(cells[0])?.match(/\b(\d{4})\b/)?.[1]);
    const linkTag = cells[3]?.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/i)?.[0];
    const href = linkTag ? attr(linkTag, "href") : undefined;
    if (!year || !href || !/InitDetail/i.test(href)) continue;
    const detailUrl = resolveFlDosUrl(href);
    const key = parseDetailKey(detailUrl);
    if (!key) continue;
    out.push({
      electionYear: year,
      status: clean(cells[1]) ?? "Unknown",
      date: clean(cells[2]),
      title: clean(cells[3]) ?? "Untitled initiative",
      serialNumber: clean(cells[4])?.replace(/\s*\([^)]*\)\s*$/, "") || undefined,
      sponsor: clean(cells[5]),
      detailUrl,
      ...key,
    });
  }
  return out;
}

function definitionValue(html: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean(new RegExp(`<dt\\b[^>]*>\\s*${escaped}\\s*</dt>\\s*<dd\\b[^>]*>([\\s\\S]*?)</dd>`, "i").exec(html)?.[1]);
}

function tableValue(html: string, label: RegExp): string | undefined {
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => clean(m[1]));
    if (cells[0] && label.test(cells[0])) return cells[1];
  }
  return undefined;
}

function numberValue(value: string | undefined): number | undefined {
  const digits = value?.replace(/[^0-9-]/g, "");
  if (!digits) return undefined;
  const result = Number(digits);
  return Number.isFinite(result) ? result : undefined;
}

/** Merge one detail page into its search result. */
export function parseFlDosDetail(html: string, base: FlDosSearchResult): FlDosInitiative {
  const heading = /<div\b[^>]*class=["'][^"']*alert-primary[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? "";
  const h5 = clean(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i.exec(heading)?.[1]);
  const h6s = [...heading.matchAll(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi)].map((m) => clean(m[1]));
  const summaryBlock = /<dt\b[^>]*>\s*Summary\s*<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/i.exec(html)?.[1] ?? "";
  const pdfHref = [...summaryBlock.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => m[1]!)
    .find((href) => /\.pdf(?:$|\?)/i.test(href));
  const paragraphs = [...summaryBlock.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => clean(m[1]))
    .filter((v): v is string => Boolean(v) && !/view full text/i.test(v));
  const status = h6s.map((v) => v?.match(/^Status\s*-\s*(.+)$/i)?.[1]).find(Boolean) ?? base.status;
  const serial = h6s.find((v) => /^\d{2}-\d{2}$/i.test(v ?? "")) ?? base.serialNumber;
  const ballotNumber = numberValue(tableValue(html, /^Ballot Number:?$/i));
  const madeBallotDate = tableValue(html, /^Made Ballot:?$/i);

  return {
    ...base,
    title: h5 ?? base.title,
    serialNumber: serial,
    status,
    reference: definitionValue(html, "Reference"),
    summary: paragraphs.join("\n\n") || undefined,
    sponsor: definitionValue(html, "Sponsor")?.replace(/Contact:.*$/i, "").trim() || base.sponsor,
    fullTextUrl: pdfHref ? resolveFlDosUrl(pdfHref, base.detailUrl) : undefined,
    ballotNumber,
    madeBallot: Boolean(madeBallotDate) || Boolean(ballotNumber && ballotNumber > 0),
    approvalDate: tableValue(html, /^Approval Date:?$/i),
    undueBurdenDate: tableValue(html, /^Undue Burden:?$/i),
    lastMadeReviewDate: tableValue(html, /^(?:Last )?Made Review:?$/i),
    attorneyGeneralDate: tableValue(html, /^Attorney General:?$/i),
    sentToSupremeCourtDate: tableValue(html, /^Sent to Supreme Court:?$/i),
    supremeCourtRuling: tableValue(html, /^Supreme Court Ruling:?$/i),
    supremeCourtRulingDate: tableValue(html, /^SC Ruling Date:?$/i),
    financialImpactStatementDate: tableValue(html, /^Financial Impact Statement Date:?$/i),
    financialImpactStatementApprovalDate: tableValue(html, /^SC Approval of Financial Impact Statement:?$/i),
    madeBallotDate,
    electionYear: numberValue(tableValue(html, /^Election Year:?$/i)) ?? base.electionYear,
    signaturesNeededForReview: numberValue(tableValue(html, /needed for judicial and financial impact review/i)),
    signaturesNeededForBallot: numberValue(tableValue(html, /needed to make ballot position/i)),
    signaturesCurrentlyValid: numberValue(tableValue(html, /currently valid/i)),
  };
}

export function sortFlDosInitiatives(items: FlDosInitiative[]): FlDosInitiative[] {
  return [...items].sort((a, b) =>
    (a.serialNumber ?? "").localeCompare(b.serialNumber ?? "") ||
    a.account.localeCompare(b.account) ||
    a.seqnum.localeCompare(b.seqnum),
  );
}

function titleNumber(title: string): string | undefined {
  return title.match(/\b(?:amendment|ballot|initiative|serial|question|measure|no\.?|#)\s*(\d{1,2}(?:-\d{1,2})?)\b/i)?.[1];
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/\b(?:florida|constitutional|amendment|initiative|measure|question|ballot|proposition)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchFlDosInitiative(items: FlDosInitiative[], title: string): FlDosInitiative | undefined {
  const number = titleNumber(title);
  if (number) {
    const byBallot = items.find((i) => i.ballotNumber && String(i.ballotNumber) === number);
    if (byBallot) return byBallot;
    const serial = number.includes("-") ? number : undefined;
    const bySerial = serial ? items.find((i) => i.serialNumber === serial) : undefined;
    if (bySerial) return bySerial;
  }
  const wanted = normalizedTitle(title);
  if (!wanted) return undefined;
  return items.find((i) => {
    const candidate = normalizedTitle(i.title);
    return candidate === wanted || (Math.min(candidate.length, wanted.length) >= 12 && (candidate.includes(wanted) || wanted.includes(candidate)));
  });
}

export async function enrichFromFlDos(
  title: string,
  stateAbbrev: string | undefined,
  electionYear: number,
): Promise<MeasureSourceData | null> {
  if (stateAbbrev?.toUpperCase() !== "FL") return null;
  const [row] = await db.select().from(CivicApiCache).where(and(
    eq(CivicApiCache.addressHash, FL_DOS_ADDRESS_HASH),
    eq(CivicApiCache.endpoint, FL_DOS_ENDPOINT),
    eq(CivicApiCache.params, flDosCacheParams(electionYear)),
  )).limit(1);
  if (!row) return null;
  const payload = row.responseData as Partial<FlDosPayload>;
  const match = matchFlDosInitiative(Array.isArray(payload.initiatives) ? payload.initiatives : [], title);
  if (!match) return null;
  return {
    tier: "state_sos",
    sourceName: FL_DOS_SOURCE_NAME,
    sourceUrl: match.detailUrl,
    official: true,
    matchedTitle: match.title,
    officialSummary: match.summary,
    fullText: match.fullText,
    fullTextUrl: match.fullTextUrl ?? match.detailUrl,
  };
}
