import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

import type { CivicEngageJurisdictionConfig } from "./civicengage.config.js";

export type MeetingType =
  | "regular"
  | "special"
  | "work_session"
  | "retreat"
  | "notice"
  | "other";
export type MeetingStatus =
  | "scheduled"
  | "held"
  | "completed"
  | "cancelled"
  | "amended";
export type DocumentType = "agenda" | "packet" | "minutes" | "html";

export interface DiscoveredDocument {
  type: DocumentType;
  title: string;
  url: string;
  mediaType: string;
  isCurrent: boolean;
}

export interface DiscoveredMeeting {
  externalId: string;
  title: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  startsAt: Date;
  location?: string;
  canonicalUrl: string;
  documents: DiscoveredDocument[];
}

export interface ParsedVote {
  voterName: string;
  value: string;
}

export interface ParsedAgendaItem {
  externalId: string;
  sequence: number;
  itemNumber: string;
  section?: string;
  itemType: string;
  title: string;
  description?: string;
  consent: boolean;
  motion?: string;
  outcome?: string;
  voteSummary?: string;
  sourceUrl: string;
  votes: ParsedVote[];
}

const SOURCE_VERSION = "civicengage-municode-v1";
export { SOURCE_VERSION };

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function directDocumentUrl(href: string, baseUrl: string): string {
  const url = new URL(href, baseUrl);
  if (url.hostname === "meetings.municode.com" && url.pathname === "/d/f") {
    const target = url.searchParams.get("u");
    if (target) return new URL(target).toString();
  }
  return url.toString();
}

function meetingType(title: string): MeetingType {
  if (/notice\s+of\s+(?:a\s+)?possible\s+quorum/i.test(title)) return "notice";
  if (/retreat/i.test(title)) return "retreat";
  if (/work\s*shop|work\s+session/i.test(title)) return "work_session";
  if (/special\s+(?:called\s+)?(?:meeting|mtg)|special\s+called/i.test(title)) {
    return "special";
  }
  if (/council\s+(?:meeting|mtg)|regular/i.test(title)) return "regular";
  return "other";
}

function meetingStatus(
  title: string,
  startsAt: Date,
  hasMinutes: boolean,
  now: Date,
): MeetingStatus {
  if (/cancel(?:led|ed|lation)/i.test(title)) return "cancelled";
  if (/amend(?:ed|ment)/i.test(title)) return "amended";
  if (hasMinutes) return "completed";
  return startsAt.getTime() > now.getTime() ? "scheduled" : "held";
}

export function parseMeetingDate(
  dateText: string,
  timeText: string,
  timezone: string,
): Date {
  const match = dateText.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const time = timeText.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match || !time)
    throw new Error(`Unrecognized meeting date: ${dateText} ${timeText}`);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(time[1]) % 12;
  if (time[3]?.toUpperCase() === "PM") hour += 12;
  const minute = Number(time[2]);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Intl gives the local wall-clock parts for a UTC guess. The delta converts
  // the desired local clock time to its real instant, including DST.
  let instant = desiredUtc;
  for (let pass = 0; pass < 2; pass++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((value) => value.type === type)?.value);
    const representedUtc = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    );
    instant += desiredUtc - representedUtc;
  }
  return new Date(instant);
}

export function parseCentralMeetingDate(
  dateText: string,
  timeText: string,
): Date {
  return parseMeetingDate(dateText, timeText, "America/Chicago");
}

function stableMeetingId(title: string, startsAt: Date): string {
  const normalizedTitle = title
    .replace(/\b(?:amended|cancelled|canceled)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
  return createHash("sha256")
    .update(`${startsAt.toISOString()}|${normalizedTitle}`)
    .digest("hex")
    .slice(0, 32);
}

export function parseMunicodePublishPage(
  html: string,
  config: CivicEngageJurisdictionConfig,
  options: { now?: Date; cutoff?: Date } = {},
): DiscoveredMeeting[] {
  const $ = cheerio.load(html);
  const now = options.now ?? new Date();
  const canonicalUrl = new URL(
    config.recordsPagePath,
    config.civicEngageBaseUrl,
  ).toString();
  const meetings: DiscoveredMeeting[] = [];

  $("table tr").each((_index, row) => {
    const $row = $(row);
    const title = clean($row.find("td.meeting").text());
    const dateText = clean($row.find("td.date").text());
    const timeText = clean($row.find("td.time").text());
    if (
      !title ||
      !dateText ||
      !timeText ||
      !config.provider.meetingNamePattern.test(title)
    )
      return;

    let startsAt: Date;
    try {
      startsAt = parseMeetingDate(dateText, timeText, config.timezone);
    } catch {
      return;
    }
    if (options.cutoff && startsAt < options.cutoff) return;

    const documents: DiscoveredDocument[] = [];
    for (const type of ["agenda", "packet", "minutes"] as const) {
      const link = $row.find(`td.${type} a`).first();
      const href = link.attr("href");
      if (!href) continue;
      documents.push({
        type,
        title: clean(link.find("img").attr("alt") ?? `${type} for ${title}`),
        url: directDocumentUrl(href, "https://meetings.municode.com"),
        mediaType: "application/pdf",
        isCurrent: true,
      });
    }

    meetings.push({
      externalId: stableMeetingId(title, startsAt),
      title,
      meetingType: meetingType(title),
      status: meetingStatus(
        title,
        startsAt,
        documents.some((document) => document.type === "minutes"),
        now,
      ),
      startsAt,
      location: clean($row.find("td.venue").text()) || undefined,
      canonicalUrl,
      documents,
    });
  });

  const grouped = new Map<string, DiscoveredMeeting>();
  for (const candidate of meetings) {
    const existing = grouped.get(candidate.externalId);
    if (!existing) {
      grouped.set(candidate.externalId, candidate);
      continue;
    }
    const candidatePreferred =
      ["amended", "cancelled"].includes(candidate.status) &&
      !["amended", "cancelled"].includes(existing.status);
    const preferred = candidatePreferred ? candidate : existing;
    const secondary = candidatePreferred ? existing : candidate;
    const preferredTypes = new Set(
      preferred.documents.map((document) => document.type),
    );
    const documents = [
      ...preferred.documents.map((document) => ({
        ...document,
        isCurrent: true,
      })),
      ...secondary.documents.map((document) => ({
        ...document,
        isCurrent: !preferredTypes.has(document.type),
      })),
    ].filter(
      (document, index, all) =>
        all.findIndex(
          (candidateDocument) => candidateDocument.url === document.url,
        ) === index,
    );
    grouped.set(candidate.externalId, { ...preferred, documents });
  }

  return [...grouped.values()].sort(
    (a, b) => b.startsAt.getTime() - a.startsAt.getTime(),
  );
}

const SECTION_NAMES = [
  "Consent Agenda",
  "Public Hearings",
  "Regular Agenda (Non-Consent)",
  "Regular Agenda",
  "Executive Session",
  "Open Meeting",
];

function normalizedLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean)
    .filter((line) => !/^City Council (?:Agenda|Minutes)$/i.test(line))
    .filter(
      (line) =>
        !/^(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}$/i.test(
          line,
        ),
    );
}

interface TextItemBlock {
  number: string;
  text: string;
  section?: string;
}

function itemBlocks(text: string): TextItemBlock[] {
  const lines = normalizedLines(text);
  const blocks: TextItemBlock[] = [];
  let section: string | undefined;
  let current: TextItemBlock | undefined;

  for (const line of lines) {
    const sectionName = SECTION_NAMES.find(
      (candidate) => candidate.toLowerCase() === line.toLowerCase(),
    );
    if (sectionName) {
      section = sectionName;
      continue;
    }
    const start = line.match(/^([A-Z]{1,2}\.\d+)\s+(.+)$/);
    if (start) {
      if (current) blocks.push(current);
      current = { number: start[1]!, text: start[2]!, section };
    } else if (current && !/^(?:Page \d+|-{3,})$/i.test(line)) {
      current.text += `\n${line}`;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function itemType(text: string, section?: string): string {
  if (/public hearing/i.test(text) || /public hearings?/i.test(section ?? ""))
    return "public_hearing";
  if (/\bordinance\b/i.test(text)) return "ordinance";
  if (/\bresolution\b/i.test(text)) return "resolution";
  if (/\bminutes\b/i.test(text)) return "minutes";
  if (/presentation|proclamation/i.test(text)) return "presentation";
  if (/executive session/i.test(section ?? "")) return "executive_session";
  return "agenda_item";
}

function firstMatch(text: string, pattern: RegExp): string | undefined {
  return clean(text.match(pattern)?.[1] ?? "") || undefined;
}

function parseRollCall(text: string): ParsedVote[] {
  const votes: ParsedVote[] = [];
  const patterns: [RegExp, string][] = [
    [/(?:Voting|Voted)\s+(?:Aye|Yes):\s*([^\n]+)/gi, "yes"],
    [/(?:Voting|Voted)\s+(?:Nay|No):\s*([^\n]+)/gi, "no"],
    [/Abstain(?:ing)?:\s*([^\n]+)/gi, "abstain"],
    [/Absent:\s*([^\n]+)/gi, "absent"],
  ];
  for (const [pattern, value] of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      for (const rawName of (match[1] ?? "").split(/,|\band\b/i)) {
        const voterName = clean(rawName.replace(/Council(?:member)?/gi, ""));
        if (voterName) votes.push({ voterName, value });
      }
    }
  }
  return votes;
}

function outcome(text: string, voteSummary?: string): string | undefined {
  if (/no action taken/i.test(text)) return "no_action";
  if (/approved under the consent agenda|motion (?:carried|passed)/i.test(text))
    return "approved";
  const tally = voteSummary?.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (tally) return Number(tally[1]) > Number(tally[2]) ? "approved" : "failed";
  return undefined;
}

export function parseAgendaItems(
  agendaText: string,
  minutesText: string | undefined,
  sourceUrl: string,
): ParsedAgendaItem[] {
  const agenda = itemBlocks(agendaText);
  const minutes = new Map(
    itemBlocks(minutesText ?? "").map((block) => [block.number, block]),
  );

  return agenda.map((block, index) => {
    const minutesBlock = minutes.get(block.number);
    const combined = minutesBlock?.text ?? block.text;
    const parsedMotion = firstMatch(
      combined,
      /(Motion to[\s\S]*?)(?=\n(?:Movant|Second|Vote):|$)/i,
    );
    const motion =
      parsedMotion &&
      /Agenda Items?/i.test(parsedMotion) &&
      !new RegExp(`\\b${block.number.replace(".", "\\.")}\\b`, "i").test(
        parsedMotion,
      ) &&
      !/consent agenda/i.test(block.section ?? "")
        ? undefined
        : parsedMotion;
    const voteSummary = firstMatch(combined, /Vote:\s*([^\n]+)/i);
    const title = clean(block.text.split("\n")[0] ?? block.text);
    const description = clean(
      block.text.replace(block.text.split("\n")[0] ?? "", ""),
    );
    return {
      externalId: block.number.toLowerCase(),
      sequence: index + 1,
      itemNumber: block.number,
      section: block.section,
      itemType: itemType(block.text, block.section),
      title,
      description: description || undefined,
      consent:
        /consent agenda/i.test(block.section ?? "") ||
        /approved under the consent agenda/i.test(combined),
      motion,
      outcome: outcome(combined, voteSummary),
      voteSummary,
      sourceUrl,
      votes: parseRollCall(combined),
    };
  });
}
