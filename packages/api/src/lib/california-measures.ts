import { and, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Contest, Source } from "./civic";

const SOURCE_CACHE_ENDPOINT = "ca_measure_source";
const SOURCE_CACHE_KEY = "__global__";
const SOURCE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CURRENT_SOS_BASE = "https://voterguide.sos.ca.gov";
const ARCHIVED_SOS_BASE = "https://vigarchive.sos.ca.gov";
const SANTA_CLARA_MEASURES_URL =
  "https://vote.santaclaracounty.gov/list-local-measures-0";

const SANTA_CLARA_PLACES = [
  "campbell",
  "cupertino",
  "gilroy",
  "los altos",
  "los gatos",
  "milpitas",
  "morgan hill",
  "mountain view",
  "palo alto",
  "san jose",
  "santa clara",
  "saratoga",
  "sunnyvale",
];

interface CaliforniaMeasureContext {
  stateAbbrev?: string;
  electionYear?: number;
  electionDate?: string;
  jurisdictionText?: string;
}

interface OfficialMeasureDetails {
  summary?: string;
  referendumSubtitle?: string;
  referendumText?: string;
  referendumProStatement?: string;
  referendumConStatement?: string;
  referendumUrl?: string;
  sources: Source[];
}

interface CachedMeasureSource {
  found: boolean;
  details?: OfficialMeasureDetails;
}

interface SantaClaraMeasure {
  code: string;
  jurisdiction: string;
  title?: string;
  voteThreshold?: string;
  ballotQuestion?: string;
  sourceUrl: string;
}

const SANTA_CLARA_2024_FALLBACK_MEASURES: SantaClaraMeasure[] = [
  {
    code: "I",
    jurisdiction: "CITY OF SANTA CLARA",
    title: "Public Facilities and Infrastructure Bond",
    voteThreshold: "2/3rds Vote",
    ballotQuestion:
      "To improve 911 emergency response; fix streets to reduce potholes and provide safer roads and routes for drivers, pedestrians, and cyclists; upgrade stormdrains/pipes to prevent flooding/sinkholes; and renovate/replace recreation, library and other community facilities; shall the City of Santa Clara's measure authorizing $400,000,000 in bonds, funded by levying an estimated $19 per $100,000 of assessed value while bonds are outstanding, generating approximately $21,674,000 annually, with annual audits and citizen oversight of spending, be adopted?",
    sourceUrl: SANTA_CLARA_MEASURES_URL,
  },
  {
    code: "R",
    jurisdiction: "SAN JOSE UNIFIED SCHOOL DISTRICT",
    title: "School Bond Measure",
    voteThreshold: "55% Vote",
    ballotQuestion:
      "To improve school safety, upgrade neighborhood schools and classrooms for science, technology, engineering, math, athletics and multipurpose use; update electrical, roofing, ventilation, and plumbing systems, and provide affordable housing to attract and retain high-quality teachers/staff, shall San Jose Unified School District's measure be adopted issuing $1,150,000,000 in bonds at legal interest rates, levying $60 per $100,000 of assessed valuation (approximately $81,000,000 annually) while bonds are outstanding, with independent citizens' oversight, annual audits, and all funds staying local?",
    sourceUrl: SANTA_CLARA_MEASURES_URL,
  },
];

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function getCachedSource(
  params: Record<string, unknown>,
): Promise<CachedMeasureSource | null> {
  const [row] = await db
    .select()
    .from(CivicApiCache)
    .where(
      and(
        eq(CivicApiCache.addressHash, SOURCE_CACHE_KEY),
        eq(CivicApiCache.endpoint, SOURCE_CACHE_ENDPOINT),
        eq(CivicApiCache.params, stableStringify(params)),
        gt(CivicApiCache.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row ? (row.responseData as CachedMeasureSource) : null;
}

async function setCachedSource(
  params: Record<string, unknown>,
  data: CachedMeasureSource,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SOURCE_CACHE_TTL_MS);

  await db
    .insert(CivicApiCache)
    .values({
      addressHash: SOURCE_CACHE_KEY,
      endpoint: SOURCE_CACHE_ENDPOINT,
      params: stableStringify(params),
      responseData: data,
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        CivicApiCache.addressHash,
        CivicApiCache.endpoint,
        CivicApiCache.params,
      ],
      set: { responseData: data, fetchedAt: now, expiresAt },
    });
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Billion civic source fetcher (https://billion.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Official measure source returned ${response.status}`);
  }

  return response.text();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    copy: "(c)",
    ldquo: '"',
    lsquo: "'",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    quot: '"',
    rdquo: '"',
    rsquo: "'",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, raw: string) => {
    const lower = raw.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }
    return named[lower] ?? entity;
  });
}

function htmlToLines(html: string): string[] {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );

  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanBlock(value: string): string | undefined {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function linesBetween(lines: string[], start: RegExp, end: RegExp): string[] {
  const startIndex = lines.findIndex((line) => start.test(line));
  if (startIndex < 0) return [];

  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && end.test(line),
  );

  return lines.slice(startIndex + 1, endIndex < 0 ? undefined : endIndex);
}

function removeSupporterText(summary: string): string {
  return summary
    .replace(/\s+Supporters\s*:.*/i, "")
    .replace(/\s+Opponents\s*:.*/i, "")
    .trim();
}

function extractCaliforniaSosDetails(
  html: string,
  sourceUrl: string,
): OfficialMeasureDetails | null {
  const lines = htmlToLines(html);
  const summaryLines = linesBetween(
    lines,
    /^SUMMARY$/i,
    /^WHAT YOUR VOTE MEANS$/i,
  ).filter((line) => !/^Put on the Ballot/i.test(line));

  const voteMeaningLines = linesBetween(
    lines,
    /^WHAT YOUR VOTE MEANS$/i,
    /^ARGUMENTS$/i,
  );
  const argumentLines = linesBetween(
    lines,
    /^ARGUMENTS$/i,
    /^FOR ADDITIONAL INFORMATION$/i,
  );

  const yesIndex = voteMeaningLines.findIndex((line) => /^YES$/i.test(line));
  const noIndex = voteMeaningLines.findIndex((line) => /^NO$/i.test(line));
  const proIndex = argumentLines.findIndex((line) => /^PRO$/i.test(line));
  const conIndex = argumentLines.findIndex((line) => /^CON$/i.test(line));

  const summary = cleanBlock(removeSupporterText(summaryLines.join(" ")));
  const yesVoteMeans =
    yesIndex >= 0
      ? cleanBlock(
          voteMeaningLines
            .slice(yesIndex + 1, noIndex >= 0 ? noIndex : undefined)
            .join(" "),
        )
      : undefined;
  const noVoteMeans =
    noIndex >= 0
      ? cleanBlock(voteMeaningLines.slice(noIndex + 1).join(" "))
      : undefined;
  const proArgument =
    proIndex >= 0
      ? cleanBlock(
          argumentLines
            .slice(proIndex + 1, conIndex >= 0 ? conIndex : undefined)
            .join(" "),
        )
      : undefined;
  const conArgument =
    conIndex >= 0
      ? cleanBlock(argumentLines.slice(conIndex + 1).join(" "))
      : undefined;

  if (
    !summary &&
    !yesVoteMeans &&
    !noVoteMeans &&
    !proArgument &&
    !conArgument
  ) {
    return null;
  }

  return {
    summary,
    referendumProStatement: yesVoteMeans ?? proArgument,
    referendumConStatement: noVoteMeans ?? conArgument,
    referendumUrl: sourceUrl,
    sources: [
      {
        name: "California Secretary of State Official Voter Information Guide",
        official: true,
        url: sourceUrl,
        fields: [
          "summary",
          "referendumProStatement",
          "referendumConStatement",
          "referendumUrl",
        ],
      },
    ],
  };
}

function electionSeason(ctx: CaliforniaMeasureContext): "primary" | "general" {
  if (!ctx.electionDate) return "general";
  const month = new Date(ctx.electionDate).getUTCMonth() + 1;
  return month > 0 && month < 7 ? "primary" : "general";
}

function propositionNumber(title?: string): string | null {
  if (!title) return null;
  const match = /\b(?:proposition|prop\.?)\s*(\d{1,3})\b/i.exec(title);
  return match?.[1] ?? null;
}

function measureCode(title?: string): string | null {
  if (!title) return null;
  const match = /\bMeasure\s+([A-Z]{1,2})(?=\s|[-–—:,.]|$)/.exec(title);
  return match?.[1]?.toUpperCase() ?? null;
}

function californiaSosUrls(
  proposition: string,
  ctx: CaliforniaMeasureContext,
): string[] {
  const year = ctx.electionYear ?? new Date().getFullYear();
  const season = electionSeason(ctx);

  return [
    `${ARCHIVED_SOS_BASE}/${year}/${season}/propositions/${proposition}/`,
    `${CURRENT_SOS_BASE}/propositions/${proposition}/`,
    `${CURRENT_SOS_BASE}/proposition/${proposition}/`,
  ];
}

async function getCaliforniaSosMeasure(
  proposition: string,
  ctx: CaliforniaMeasureContext,
): Promise<OfficialMeasureDetails | null> {
  const params = {
    source: "california-sos",
    proposition,
    electionYear: ctx.electionYear,
    season: electionSeason(ctx),
  };
  const cached = await getCachedSource(params);
  if (cached) return cached.found ? (cached.details ?? null) : null;

  for (const url of californiaSosUrls(proposition, ctx)) {
    try {
      const html = await fetchHtml(url);
      const details = extractCaliforniaSosDetails(html, url);
      if (details) {
        await setCachedSource(params, { found: true, details });
        return details;
      }
    } catch {
      // Try the next canonical/current voter-guide location.
    }
  }

  await setCachedSource(params, { found: false });
  return null;
}

function isSantaClaraContext(ctx: CaliforniaMeasureContext): boolean {
  const text = (ctx.jurisdictionText ?? "").toLowerCase();
  return (
    text.includes("santa clara") ||
    SANTA_CLARA_PLACES.some((place) => text.includes(place))
  );
}

function extractSantaClaraMeasures(html: string): SantaClaraMeasure[] {
  const lines = htmlToLines(html);
  const measures: SantaClaraMeasure[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const code = measureCode(lines[index]);
    if (!code) continue;

    const jurisdiction = lines[index - 1];
    if (!jurisdiction || /^(\*|-|YES|NO|BONDS)/i.test(jurisdiction)) {
      continue;
    }

    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line) continue;
      if (measureCode(line)) break;
      if (/^\*\s*\*\s*\*$/.test(line)) break;
      if (/^(YES|NO|BONDS|- YES|- NO)$/i.test(line)) break;
      if (/^(Primary|Rebuttal|Impartial Analysis)/i.test(line)) continue;
      body.push(line);
    }

    const [title, voteThreshold, ...questionParts] = body;
    const ballotQuestion = cleanBlock(questionParts.join(" "));
    measures.push({
      code,
      jurisdiction,
      title: cleanBlock(title ?? ""),
      voteThreshold: cleanBlock(voteThreshold ?? ""),
      ballotQuestion,
      sourceUrl: SANTA_CLARA_MEASURES_URL,
    });
  }

  return measures;
}

function titleTokens(value?: string): Set<string> {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && token !== "measure"),
  );
}

function similarity(a?: string, b?: string): number {
  const aTokens = titleTokens(a);
  const bTokens = titleTokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
}

function bestSantaClaraMeasure(
  measures: SantaClaraMeasure[],
  code: string,
  contestTitle?: string,
): SantaClaraMeasure | undefined {
  const matches = measures.filter((measure) => measure.code === code);
  return (
    matches
      .map((measure) => ({
        measure,
        score: Math.max(
          similarity(contestTitle, measure.title),
          similarity(contestTitle, measure.jurisdiction),
        ),
      }))
      .sort((a, b) => b.score - a.score)[0]?.measure ?? matches[0]
  );
}

function santaClaraDetailsFromMeasure(
  measure: SantaClaraMeasure | undefined,
): OfficialMeasureDetails | null {
  if (!measure?.ballotQuestion) return null;

  return {
    referendumSubtitle: measure.ballotQuestion,
    referendumUrl: measure.sourceUrl,
    sources: [
      {
        name: `Santa Clara County Registrar of Voters${
          measure.jurisdiction ? ` - ${measure.jurisdiction}` : ""
        }`,
        official: true,
        url: measure.sourceUrl,
        fields: ["referendumSubtitle", "referendumUrl"],
      },
    ],
  };
}

async function getSantaClaraMeasure(
  code: string,
  contestTitle: string | undefined,
  ctx: CaliforniaMeasureContext,
): Promise<OfficialMeasureDetails | null> {
  if (!isSantaClaraContext(ctx)) return null;

  const params = {
    source: "santa-clara-rov",
    measure: code,
    electionYear: ctx.electionYear,
  };
  const cached = await getCachedSource(params);
  if (cached) return cached.found ? (cached.details ?? null) : null;

  try {
    const html = await fetchHtml(SANTA_CLARA_MEASURES_URL);
    const details = santaClaraDetailsFromMeasure(
      bestSantaClaraMeasure(
        extractSantaClaraMeasures(html),
        code,
        contestTitle,
      ),
    );
    if (details) {
      await setCachedSource(params, { found: true, details });
      return details;
    }
  } catch {
    // Leave the Google Civic fields in place when the county source is unavailable.
  }

  if (ctx.electionYear === 2024) {
    const details = santaClaraDetailsFromMeasure(
      bestSantaClaraMeasure(
        SANTA_CLARA_2024_FALLBACK_MEASURES,
        code,
        contestTitle,
      ),
    );
    if (details) {
      await setCachedSource(params, { found: true, details });
      return details;
    }
  }

  await setCachedSource(params, { found: false });
  return null;
}

function mergeSources(
  existing: Source[] | undefined,
  incoming: Source[],
): Source[] {
  const sources = [...(existing ?? [])];
  for (const source of incoming) {
    const duplicate = sources.some(
      (item) => item.name === source.name && item.url === source.url,
    );
    if (!duplicate) sources.push(source);
  }
  return sources;
}

function applyDetails(
  contest: Contest,
  details: OfficialMeasureDetails,
): Contest {
  return {
    ...contest,
    summary: details.summary ?? contest.summary,
    referendumSubtitle:
      details.referendumSubtitle ?? contest.referendumSubtitle,
    referendumText: details.referendumText ?? contest.referendumText,
    referendumProStatement:
      details.referendumProStatement ?? contest.referendumProStatement,
    referendumConStatement:
      details.referendumConStatement ?? contest.referendumConStatement,
    referendumUrl: details.referendumUrl ?? contest.referendumUrl,
    sources: mergeSources(contest.sources, details.sources),
  };
}

export async function enrichFromCaliforniaOfficialSources(
  contest: Contest,
  ctx: CaliforniaMeasureContext,
): Promise<Contest> {
  if (ctx.stateAbbrev?.toUpperCase() !== "CA" || !contest.referendumTitle) {
    return contest;
  }

  const proposition = propositionNumber(contest.referendumTitle);
  if (proposition) {
    const details = await getCaliforniaSosMeasure(proposition, ctx);
    return details ? applyDetails(contest, details) : contest;
  }

  const code = measureCode(contest.referendumTitle);
  if (code) {
    const details = await getSantaClaraMeasure(
      code,
      contest.referendumTitle,
      ctx,
    );
    return details ? applyDetails(contest, details) : contest;
  }

  return contest;
}
