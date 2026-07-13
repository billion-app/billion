/** SPUR Bay Area voter-guide cache adapter and pure HTML parsers. */
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import { decodeEntities, htmlToText } from "./html";
import type { MeasureArgument, MeasureSourceData } from "./types";

export const SPUR_ROOT = "https://www.spur.org";
export const SPUR_ENDPOINT = "spur-voter-guide-v1";
export const SPUR_ADDRESS_HASH = "__global__";
export const SPUR_SOURCE_NAME = "SPUR Voter Guide";

export interface SpurMeasure {
  electionYear: number;
  electionMonth: number;
  jurisdiction: "SF" | "SJ" | "OAK" | "CA";
  measureType: "Prop" | "Measure";
  measureCode: string;
  title: string;
  subtitle?: string;
  sourceUrl: string;
  whatItWouldDo?: string;
  background?: string;
  equityImpacts?: string;
  pros: string[];
  cons: string[];
  recommendation?: string;
  recommendationRationale?: string;
  publishedAt?: string;
  modifiedAt?: string;
}

export interface SpurPayload {
  sourceVersion: 1;
  guideUrl: string;
  measures: SpurMeasure[];
}

export function spurCacheParams(year: number, month: number): string {
  return JSON.stringify({ year, month });
}

export function parseSpurGuideLinks(html: string, year: number, month: number): string[] {
  const prefix = `/voter-guide/${year}-${String(month).padStart(2, "0")}/`;
  return [...new Set(
    [...html.matchAll(/href=["']([^"'#?]+)["']/gi)]
      .map((m) => decodeEntities(m[1] ?? ""))
      .filter((href) => href.startsWith(prefix) && /\/(?:sf-prop|sj-measure|oak-measure|ca-prop)-/i.test(href)),
  )].map((href) => new URL(href, SPUR_ROOT).toString());
}

function cleanHtml(value: string | undefined): string | undefined {
  const text = value ? htmlToText(value).replace(/\n{3,}/g, "\n\n").trim() : "";
  return text || undefined;
}

function meta(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeEntities(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i").exec(html)?.[1] ?? "") || undefined;
}

function section(body: string, heading: RegExp): string | undefined {
  const headings = [...body.matchAll(/<h3\b[^>]*>[\s\S]*?<\/h3>/gi)];
  const found = headings.find((h) => heading.test(htmlToText(h[0])));
  if (!found || found.index === undefined) return undefined;
  const start = found.index + found[0].length;
  const next = headings.find((h) => (h.index ?? 0) >= start);
  return body.slice(start, next?.index ?? body.length);
}

function listItems(value: string | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => cleanHtml(m[1]))
    .filter((item): item is string => Boolean(item));
}

function slugIdentity(url: string): Pick<SpurMeasure, "electionYear" | "electionMonth" | "jurisdiction" | "measureType" | "measureCode"> | null {
  const match = new URL(url).pathname.match(/^\/voter-guide\/(\d{4})-(\d{2})\/(sf-prop|sj-measure|oak-measure|ca-prop)-([a-z0-9]+)/i);
  if (!match) return null;
  const prefix = match[3]!.toLowerCase();
  return {
    electionYear: Number(match[1]),
    electionMonth: Number(match[2]),
    jurisdiction: prefix.startsWith("sf") ? "SF" : prefix.startsWith("sj") ? "SJ" : prefix.startsWith("oak") ? "OAK" : "CA",
    measureType: prefix.includes("prop") ? "Prop" : "Measure",
    measureCode: match[4]!.toUpperCase(),
  };
}

export function parseSpurMeasurePage(html: string, sourceUrl: string): SpurMeasure | null {
  const identity = slugIdentity(sourceUrl);
  if (!identity) return null;
  const body = /<div\b[^>]*class=["'][^"']*field--name-field-body[^"']*["'][^>]*>([\s\S]*?)<div\s+id=["']recommendation["']/i.exec(html)?.[1];
  if (!body) return null;
  const recBlock = /<div\s+id=["']recommendation["'][^>]*>([\s\S]*?)<div\b[^>]*class=["'][^"']*field--name-field-footnotes/i.exec(html)?.[1] ?? "";
  const recommendation = cleanHtml(/field--name-field-recommendation["'][^>]*>([\s\S]*?)<\/span>/i.exec(recBlock)?.[1]);
  const rationale = cleanHtml(/field--name-field-recommendation-summary[\s\S]*?<div>\s*([\s\S]*?)<\/div>\s*<\/div>/i.exec(recBlock)?.[1]);
  const titleMeta = meta(html, "og:title") ?? "SPUR ballot measure";
  const shortTitle = cleanHtml(/field--name-field-short-title["'][^>]*>([\s\S]*?)<\/span>/i.exec(recBlock)?.[1]);
  const what = section(body, /what the measure would do/i);
  const background = section(body, /(?:the )?backstory|background/i);
  const equity = section(body, /equity impacts?/i);
  const pros = section(body, /^pros$/i);
  const cons = section(body, /^cons$/i);
  return {
    ...identity,
    title: shortTitle ?? titleMeta.replace(/^.*?\s(?:Prop|Measure)\s+[A-Z0-9]+\s*-\s*/i, ""),
    subtitle: meta(html, "description"),
    sourceUrl,
    whatItWouldDo: cleanHtml(what),
    background: cleanHtml(background),
    equityImpacts: cleanHtml(equity),
    pros: listItems(pros),
    cons: listItems(cons),
    recommendation,
    recommendationRationale: rationale,
    publishedAt: meta(html, "article:published_time"),
    modifiedAt: meta(html, "article:modified_time"),
  };
}

function jurisdictionForCounty(county: string | undefined): SpurMeasure["jurisdiction"] | undefined {
  if (!county) return undefined;
  if (/san\s*francisco/i.test(county)) return "SF";
  if (/santa\s*clara|san\s*jos[eé]/i.test(county)) return "SJ";
  if (/alameda|oakland/i.test(county)) return "OAK";
  return undefined;
}

function measureCode(title: string): string | undefined {
  return title.match(/\b(?:prop(?:osition)?|measure)\s+([a-z0-9]+)\b/i)?.[1]?.toUpperCase();
}

export function matchSpurMeasure(measures: SpurMeasure[], title: string, county?: string): SpurMeasure | undefined {
  const code = measureCode(title);
  const jurisdiction = jurisdictionForCounty(county);
  const candidates = measures.filter((measure) => (!jurisdiction || measure.jurisdiction === jurisdiction) && (!code || measure.measureCode === code));
  if (candidates.length === 1) return candidates[0];
  const normalized = title.toLowerCase().replace(/\b(?:san francisco|san jose|oakland|prop(?:osition)?|measure)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  return candidates.find((measure) => {
    const candidate = measure.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return candidate === normalized || (normalized.length >= 8 && (candidate.includes(normalized) || normalized.includes(candidate)));
  });
}

function args(items: string[], sourceUrl: string): MeasureArgument[] | undefined {
  return items.length ? items.map((text) => ({ text, sourceName: SPUR_SOURCE_NAME, sourceUrl })) : undefined;
}

export async function enrichFromSpur(title: string, stateAbbrev: string | undefined, county: string | undefined, electionYear: number): Promise<MeasureSourceData | null> {
  if (stateAbbrev?.toUpperCase() !== "CA") return null;
  const rows = await db.select().from(CivicApiCache).where(and(
    eq(CivicApiCache.addressHash, SPUR_ADDRESS_HASH),
    eq(CivicApiCache.endpoint, SPUR_ENDPOINT),
  ));
  const measures = rows.flatMap((row) => {
    const payload = row.responseData as Partial<SpurPayload>;
    return Array.isArray(payload.measures) ? payload.measures : [];
  }).filter((measure) => measure.electionYear === electionYear);
  const match = matchSpurMeasure(measures, title, county);
  if (!match) return null;
  return {
    tier: "expert_analysis",
    sourceName: SPUR_SOURCE_NAME,
    sourceUrl: match.sourceUrl,
    official: false,
    matchedTitle: `${match.measureType} ${match.measureCode}: ${match.title}`,
    proArguments: args(match.pros, match.sourceUrl),
    conArguments: args(match.cons, match.sourceUrl),
    expertAnalysis: {
      background: match.background ?? match.whatItWouldDo,
      equityImpacts: match.equityImpacts,
      recommendation: match.recommendation,
      recommendationRationale: match.recommendationRationale,
    },
  };
}
