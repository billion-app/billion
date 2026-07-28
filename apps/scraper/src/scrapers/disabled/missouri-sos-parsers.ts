import * as cheerio from "cheerio";

import type {
  MissouriBallotMeasure,
  MissouriCandidate,
  MissouriCitation,
  MissouriElection,
  MissouriResultContest,
} from "@acme/api/lib/missouri-election-data";

export const MISSOURI_STRUCTURE_VERSION = "mo-sos-current-election-v1";
export const MISSOURI_CANDIDATES_URL = "https://s1.sos.mo.gov/candidatesonweb/";
export const MISSOURI_MEASURES_URL =
  "https://www.sos.mo.gov/petitions/2026BallotMeasures";
export const MISSOURI_RESULTS_URL =
  "https://www.sos.mo.gov/elections/showmovotes";
export const MISSOURI_CALENDAR_URL =
  "https://www.sos.mo.gov/elections/calendar/2026cal";

export interface MissouriOfficeReference {
  office: string;
  url: string;
}

export interface MissouriCandidateDiscovery {
  electionCode: string;
  electionName: string;
  candidatesUrl: string;
  offices: MissouriOfficeReference[];
  withdrawalsUrl: string;
}

function compact(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href: string, baseUrl: string): string {
  return new URL(href, baseUrl).toString();
}

function isoDate(value: string): string | null {
  const match =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(2026)\b/i.exec(
      value,
    ) ?? /\b(\d{1,2})\/(\d{1,2})\/(2026)\b/.exec(value);
  if (!match) return null;
  if (/^\d/.test(match[1] ?? "")) {
    return `${match[3]}-${String(match[1]).padStart(2, "0")}-${String(
      match[2],
    ).padStart(2, "0")}`;
  }
  const month =
    [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf((match[1] ?? "").toLowerCase()) + 1;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(
    match[2],
  ).padStart(2, "0")}`;
}

function citation(label: string, sourceUrl: string): MissouriCitation {
  return { label, sourceUrl };
}

export function parseMissouriCalendar(
  html: string,
  asOf = new Date(),
  sourceUrl = MISSOURI_CALENDAR_URL,
  preferredType?: MissouriElection["type"],
): MissouriElection {
  const $ = cheerio.load(html);
  const elections: MissouriElection[] = [];
  $("table.cal tr").each((_index, row) => {
    const cells = $(row)
      .find("td")
      .map((_cellIndex, cell) => compact($(cell).text()))
      .get();
    if (cells.length < 6) return;
    const electionDate = isoDate(cells[0] ?? "");
    const finalCertificationDate = isoDate(cells[5] ?? "") ?? undefined;
    const style = cells[1] ?? "";
    const type = /primary election/i.test(style)
      ? "primary"
      : /general election/i.test(style) && !/municipal/i.test(style)
        ? "general"
        : null;
    if (!electionDate || !type) return;
    elections.push({
      name: `2026 ${type === "primary" ? "Primary" : "General"} Election`,
      type,
      electionDate,
      finalCertificationDate,
      citation: citation("2026 Missouri election calendar", sourceUrl),
    });
  });
  if (!elections.length) {
    throw new Error(
      "Missouri calendar contained no 2026 primary/general election",
    );
  }
  const preferred = preferredType
    ? elections.find((election) => election.type === preferredType)
    : undefined;
  if (preferred) return preferred;
  const today = asOf.toISOString().slice(0, 10);
  return (
    elections.find((election) => election.electionDate >= today) ??
    elections.at(-1)!
  );
}

export function parseMissouriCandidateDiscovery(
  html: string,
  baseUrl = MISSOURI_CANDIDATES_URL,
): MissouriCandidateDiscovery {
  const $ = cheerio.load(html);
  const electionName = compact($("#main h2, #right h2").first().text());
  const references = new Map<string, MissouriOfficeReference>();
  let electionCode = "";
  $("a[href*='DisplayCandidatesPlacement.aspx']").each((_index, anchor) => {
    const href = $(anchor).attr("href");
    const office = compact($(anchor).text());
    if (!href || !office) return;
    const url = new URL(href, baseUrl);
    const code = url.searchParams.get("ElectionCode");
    const officeCode = url.searchParams.get("OfficeCode");
    if (!code || !officeCode) return;
    electionCode ||= code;
    references.set(url.toString(), { office, url: url.toString() });
  });
  if (!electionCode || !references.size || !/2026/i.test(electionName)) {
    throw new Error(
      "Candidate filing page did not expose a certified 2026 election",
    );
  }
  return {
    electionCode,
    electionName,
    candidatesUrl: absoluteUrl(
      `DisplayCandidatesPlacement.aspx?ElectionCode=${encodeURIComponent(electionCode)}`,
      baseUrl,
    ),
    offices: [...references.values()],
    withdrawalsUrl: absoluteUrl(
      `CandidatesRemoved.aspx?ElectionCode=${encodeURIComponent(electionCode)}`,
      baseUrl,
    ),
  };
}

function officeParts(value: string): { office: string; district?: string } {
  const normalized = compact(value);
  const match = /^(.*?)\s*-?\s+District\s+(\d+)$/i.exec(normalized);
  return match
    ? { office: compact(match[1] ?? normalized), district: match[2] }
    : { office: normalized };
}

export function parseMissouriCandidateOffice(
  html: string,
  sourceUrl: string,
): MissouriCandidate[] {
  const $ = cheerio.load(html);
  if (!/Certified Candidate List/i.test($("#main h1").text())) {
    throw new Error("Candidate office page was not a certified candidate list");
  }
  const candidates: MissouriCandidate[] = [];
  $("#main table").each((_tableIndex, table) => {
    const party = compact($(table).find("caption").text());
    const parsedOffice = officeParts($(table).prevAll("h3").first().text());
    if (!parsedOffice.office) return;
    $(table)
      .find("tr")
      .slice(1)
      .each((rowIndex, row) => {
        // Deliberately select only the public name cell. Address, filing date,
        // and every other candidate contact/location field are ignored.
        const name = compact($(row).find("td.NameCol").text());
        if (!name || !party) return;
        candidates.push({
          ...parsedOffice,
          party,
          name,
          ballotOrder: rowIndex + 1,
          status: "certified",
          citation: citation(
            "Certified candidate list in ballot order",
            sourceUrl,
          ),
        });
      });
  });
  return candidates;
}

export function parseMissouriWithdrawals(
  html: string,
  sourceUrl: string,
): MissouriCandidate[] {
  const $ = cheerio.load(html);
  const candidates: MissouriCandidate[] = [];
  $("table[title='Removed Candidates'] tr")
    .slice(1)
    .each((_index, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;
      const parsedOffice = officeParts($(cells[0]).text());
      // The bold span contains only name + party; the following address node is
      // intentionally never read.
      const identity = compact($(cells[1]).find("span").first().text());
      const match = /^(.*?)\s*\(([^()]+)\)$/.exec(identity);
      const reason = compact($(cells[2]).text());
      const dateCell = $(cells[3]).clone();
      dateCell.find("br").replaceWith(" ");
      const withdrawalDate = isoDate(compact(dateCell.text())) ?? undefined;
      if (!match?.[1] || !match[2] || !reason) return;
      candidates.push({
        ...parsedOffice,
        name: compact(match[1]),
        party: compact(match[2]),
        ballotOrder: candidates.length + 1,
        status: /withdraw/i.test(reason) ? "withdrawn" : "removed",
        withdrawalReason: reason,
        withdrawalDate,
        citation: citation("Certified withdrawn/removed candidates", sourceUrl),
      });
    });
  return candidates;
}

interface MeasureDraft {
  officialTitle: string;
  electionDate: string;
  fullTextUrl?: string;
  certificateUrl?: string;
  officialParagraphs: string[];
  fairParagraphs: string[];
}

export function parseMissouriBallotMeasures(
  html: string,
  sourceUrl = MISSOURI_MEASURES_URL,
): MissouriBallotMeasure[] {
  const $ = cheerio.load(html);
  let electionDate = "";
  let mode: "official" | "fair" | null = null;
  let draft: MeasureDraft | null = null;
  const drafts: MeasureDraft[] = [];

  $("#main")
    .find("h2, p")
    .each((_index, element) => {
      const tag = element.tagName.toLowerCase();
      const text = compact($(element).text());
      if (tag === "h2" && /certified/i.test(text)) {
        electionDate = isoDate(text) ?? electionDate;
        return;
      }
      if (tag !== "p" || !text) return;
      const title =
        /^Official Ballot Title\s*(Amendment\s+\d+|Proposition\s+\w+)/i.exec(
          text,
        );
      if (title?.[1]) {
        draft = {
          officialTitle: compact(title[1]),
          electionDate,
          officialParagraphs: [],
          fairParagraphs: [],
        };
        drafts.push(draft);
        mode = null;
        return;
      }
      if (!draft) return;
      const full = $(element).find("a[title*='full text' i]").attr("href");
      if (full) draft.fullTextUrl = absoluteUrl(full, sourceUrl);
      const certificate = $(element)
        .find("a[title*='Certificate of Official Ballot Title' i]")
        .attr("href");
      if (certificate)
        draft.certificateUrl = absoluteUrl(certificate, sourceUrl);
      if (/^Official Ballot Title:?$/i.test(text)) {
        mode = "official";
        return;
      }
      if (/^Fair Ballot Language:?$/i.test(text)) {
        mode = "fair";
        return;
      }
      if (mode === "official") draft.officialParagraphs.push(text);
      if (mode === "fair") draft.fairParagraphs.push(text);
    });

  return drafts.flatMap((item) => {
    const fiscalStatement = item.officialParagraphs
      .filter((paragraph) =>
        /(?:cost|saving|revenue|fiscal|tax|financial impact)/i.test(paragraph),
      )
      .at(-1);
    if (
      !item.electionDate ||
      !item.fullTextUrl ||
      !item.certificateUrl ||
      !item.officialParagraphs.length ||
      !item.fairParagraphs.length ||
      !fiscalStatement
    ) {
      return [];
    }
    return [
      {
        officialTitle: item.officialTitle,
        officialBallotLanguage: item.officialParagraphs.join("\n\n"),
        fairBallotLanguage: item.fairParagraphs.join("\n\n"),
        fiscalStatement,
        electionDate: item.electionDate,
        fullTextUrl: item.fullTextUrl,
        certificateUrl: item.certificateUrl,
        certificationStatus: "certified" as const,
        citation: citation("Certified 2026 ballot measure", sourceUrl),
      },
    ];
  });
}

export function discoverMissouriResultsUrl(
  html: string,
  activeElection: MissouriElection,
  baseUrl = MISSOURI_RESULTS_URL,
): string | null {
  const $ = cheerio.load(html);
  const dateWords = new Date(
    `${activeElection.electionDate}T12:00:00Z`,
  ).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  let found: string | null = null;
  $("a[href]").each((_index, anchor) => {
    if (found) return;
    const href = $(anchor).attr("href");
    const text = compact($(anchor).text());
    const imageAlt = compact($(anchor).find("img").attr("alt") ?? "");
    const context = compact($(anchor).parent().text());
    const signal = `${text} ${imageAlt} ${context} ${href}`;
    if (!href || !/result/i.test(signal)) return;
    if (!/2026/.test(signal)) return;
    if (
      !new RegExp(activeElection.type, "i").test(signal) &&
      !signal.includes(dateWords)
    )
      return;
    found = absoluteUrl(href, baseUrl);
  });
  return found;
}

function numeric(value: string): number {
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseMissouriResults(
  html: string,
  sourceUrl: string,
): { contests: MissouriResultContest[]; updatedAt?: string } {
  const $ = cheerio.load(html);
  const contests: MissouriResultContest[] = [];
  $("table").each((_tableIndex, table) => {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th")
      .map((_index, header) => compact($(header).text()).toLowerCase())
      .get();
    const nameIndex = headers.findIndex((header) =>
      /candidate|choice|option/.test(header),
    );
    const votesIndex = headers.findIndex((header) =>
      /votes|total/.test(header),
    );
    if (nameIndex < 0 || votesIndex < 0) return;
    const partyIndex = headers.findIndex((header) => /party/.test(header));
    const percentIndex = headers.findIndex((header) =>
      /percent|%/.test(header),
    );
    const contest =
      compact($(table).find("caption").text()) ||
      compact($(table).prevAll("h2, h3, h4").first().text());
    if (!contest) return;
    const choices: MissouriResultContest["choices"] = [];
    $(table)
      .find("tr")
      .slice(1)
      .each((_rowIndex, row) => {
        const cells = $(row).find("td");
        const name = compact($(cells[nameIndex]).text());
        if (!name) return;
        const percentText =
          percentIndex >= 0 ? compact($(cells[percentIndex]).text()) : "";
        const parsedPercent = percentText
          ? Number.parseFloat(percentText)
          : undefined;
        choices.push({
          name,
          party:
            partyIndex >= 0
              ? compact($(cells[partyIndex]).text()) || undefined
              : undefined,
          votes: numeric(compact($(cells[votesIndex]).text())),
          percent:
            parsedPercent !== undefined && Number.isFinite(parsedPercent)
              ? parsedPercent
              : undefined,
        });
      });
    if (!choices.length) return;
    const district = /District\s+(\d+)/i.exec(contest)?.[1];
    contests.push({
      contest,
      district,
      choices,
      totalVotes: choices.reduce((sum, choice) => sum + choice.votes, 0),
      reportingStatus:
        compact($(table).attr("data-reporting-status") ?? "") || undefined,
      citation: citation("Official Missouri SOS election results", sourceUrl),
    });
  });
  if (!contests.length) {
    throw new Error(
      "Official results page contained no parseable contest tables",
    );
  }
  const pageText = compact($("body").text());
  const updatedAt = /(?:Last Updated|Updated)\s*:?\s*([^|]+?)(?:\||$)/i.exec(
    pageText,
  )?.[1];
  return { contests, updatedAt: updatedAt ? compact(updatedAt) : undefined };
}
