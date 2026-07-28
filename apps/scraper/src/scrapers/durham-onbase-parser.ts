import * as cheerio from "cheerio";

export const DURHAM_ONBASE_BASE_URL =
  "https://cityordinances.durhamnc.gov/OnBaseAgendaOnline/";

export interface OnBaseMeetingIndexItem {
  id: number;
  name: string;
  meetingType: string;
  date: Date;
  location?: string;
  isAgendaAvailable: boolean;
  isMinutesAvailable: boolean;
  agendaUniqueName: string;
  minutesUniqueName: string;
  latestDocumentType: 1 | 2 | 3;
}

export interface ParsedOnBaseAttachment {
  externalId: string;
  title: string;
  url: string;
}

export interface ParsedOnBaseAgendaItem {
  externalId: string;
  section?: string;
  agendaNumber?: string;
  title: string;
  actionText?: string;
  voteText?: string;
  attachments: ParsedOnBaseAttachment[];
  sortOrder: number;
}

interface RawMeeting {
  ID?: unknown;
  Name?: unknown;
  MeetingTypeName?: unknown;
  Time?: unknown;
  Location?: unknown;
  IsAgendaAvailable?: unknown;
  IsMinutesAvailable?: unknown;
  AgendaUniqueName?: unknown;
  MinutesUniqueName?: unknown;
  LatestDocumentType?: unknown;
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonObject(source: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index++) {
    const char = source[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0)
      return source.slice(start, index + 1);
  }

  throw new Error("Unterminated OnBase meeting index JSON");
}

export function parseMeetingIndex(html: string): OnBaseMeetingIndexItem[] {
  const marker = "showSearchResults(new SearchResults(";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0)
    throw new Error("OnBase meeting index payload not found");
  const jsonStart = html.indexOf("{", markerIndex + marker.length);
  if (jsonStart < 0) throw new Error("OnBase meeting index JSON not found");

  const payload = JSON.parse(extractJsonObject(html, jsonStart)) as {
    Meetings?: RawMeeting[];
  };

  return (payload.Meetings ?? []).flatMap((raw) => {
    if (
      typeof raw.ID !== "number" ||
      typeof raw.Name !== "string" ||
      typeof raw.MeetingTypeName !== "string" ||
      typeof raw.Time !== "string" ||
      typeof raw.AgendaUniqueName !== "string" ||
      typeof raw.MinutesUniqueName !== "string"
    ) {
      return [];
    }
    const date = new Date(raw.Time);
    if (Number.isNaN(date.getTime())) return [];
    const latest =
      raw.LatestDocumentType === 2 || raw.LatestDocumentType === 3
        ? raw.LatestDocumentType
        : 1;

    return [
      {
        id: raw.ID,
        name: cleanText(raw.Name),
        meetingType: cleanText(raw.MeetingTypeName),
        date,
        location:
          typeof raw.Location === "string" && cleanText(raw.Location)
            ? cleanText(raw.Location)
            : undefined,
        isAgendaAvailable: raw.IsAgendaAvailable === true,
        isMinutesAvailable: raw.IsMinutesAvailable === true,
        agendaUniqueName: raw.AgendaUniqueName,
        minutesUniqueName: raw.MinutesUniqueName,
        latestDocumentType: latest,
      },
    ];
  });
}

function extractVoteText(actionText: string): string | undefined {
  const matches = actionText.match(
    /\[(?:approved|failed)[^\]]*\]|\[motion referred[^\]]*\]|no vote (?:was )?taken\.?|ayes:\s*[^.]*\.?|nays:\s*[^.]*\.?/gi,
  );
  return matches ? cleanText(matches.join(" ")) : undefined;
}

export function parseAgendaOutline(html: string): ParsedOnBaseAgendaItem[] {
  const $ = cheerio.load(html);
  const items: ParsedOnBaseAgendaItem[] = [];
  let currentSection: string | undefined;

  $("a[href*='loadAgendaItem']").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href") ?? "";
    const match = /loadAgendaItem\((\d+),(true|false)\)/.exec(href);
    if (!match) return;
    const title = cleanText(anchor.text());
    if (!title) return;
    if (match[2] === "true") {
      currentSection = title;
      return;
    }

    const externalId = match[1]!;
    const agendaMatch = /^(\d+[A-Za-z]?)\.\s*(.+)$/.exec(title);
    const displayTitle = agendaMatch?.[2] ?? title;
    const tableText = cleanText(anchor.closest("table").text());
    const actionText = cleanText(
      tableText.startsWith(title) ? tableText.slice(title.length) : tableText,
    );

    items.push({
      externalId,
      section: currentSection,
      agendaNumber: agendaMatch?.[1],
      title: displayTitle,
      actionText: actionText || undefined,
      voteText: actionText ? extractVoteText(actionText) : undefined,
      attachments: [],
      sortOrder: items.length,
    });
  });

  return items;
}

export function parseItemAttachments(
  html: string,
  baseUrl = DURHAM_ONBASE_BASE_URL,
): ParsedOnBaseAttachment[] {
  const $ = cheerio.load(html);
  return $("a[href*='/Documents/DownloadFile/']")
    .toArray()
    .flatMap((element) => {
      const anchor = $(element);
      const href = anchor.attr("href");
      if (!href) return [];
      const url = new URL(href, baseUrl);
      const externalId =
        url.searchParams.get("publishId") ??
        (anchor.attr("id")?.match(/(\d+)$/)?.[1] || url.toString());
      return [
        {
          externalId,
          title: cleanText(anchor.text()),
          url: url.toString(),
        },
      ];
    });
}
