import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { z } from "zod/v4";

const CITY_BASE = "https://www.stlouis-mo.gov";
const AGENDA_INDEX = `${CITY_BASE}/government/departments/aldermen/aldermanic-legislative-session.cfm`;

export interface StLouisSession {
  id: string;
  label: string;
}

export interface StLouisCalendarMeeting {
  eventId: string;
  civicClerkId: string | null;
  title: string;
  startsAt: Date;
  canonicalUrl: string;
}

export interface StLouisDocument {
  externalId: string;
  type: "agenda" | "minutes" | "packet" | "attachment" | "bill-text";
  title: string;
  url: string;
  sourceVersion: string;
  checksum: string;
}

export interface StLouisLegislationRef {
  kind: "board-bill" | "resolution";
  externalId: string;
  number: string;
  title: string;
  sponsors: string[];
  sourceUrl: string;
  action?: string;
  introducedAt?: Date;
  documents: StLouisDocument[];
}

export interface StLouisAgendaWeek {
  agendaViewId: string;
  sessionId: string;
  week: number;
  weekOf: string;
  detailUrl: string;
  documents: StLouisDocument[];
}

export interface StLouisAgendaDetail extends StLouisAgendaWeek {
  eventId: string | null;
  legislation: StLouisLegislationRef[];
}

export interface StLouisEventDetail {
  eventId: string;
  civicClerkId: string | null;
  title: string;
  meetingType: string;
  location: string | null;
  isCancelled: boolean;
  videoUrl: string | null;
  legislation: StLouisLegislationRef[];
}

const civicFileSchema = z
  .object({
    fileId: z.number(),
    type: z.string(),
    publishedOn: z.string(),
    name: z.string(),
    url: z.url(),
  })
  .passthrough();

const civicAttachmentSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    publicUrl: z.url(),
  })
  .passthrough();

const civicFieldSchema = z
  .object({ name: z.string(), value: z.string() })
  .passthrough();

export const stLouisCivicItemSchema: z.ZodType<StLouisCivicItem> = z.lazy(() =>
  z
    .object({
      id: z.number(),
      idNumber: z.string().default(""),
      itemName: z.string(),
      agendaObjectItemOutlineNumber: z.string().nullable().default(""),
      agendaObjItemCategoryTypeDesc: z.string().nullable().default(null),
      agendaObjectItemDescription: z.string().nullable().default(null),
      isSection: z.boolean().default(false),
      customTextField8: civicFieldSchema.optional(),
      recommendedActions: z.array(z.unknown()).default([]),
      attachmentsList: z.array(civicAttachmentSchema).default([]),
      childItems: z.array(stLouisCivicItemSchema).nullable().default(null),
    })
    .passthrough(),
);

export interface StLouisCivicItem {
  id: number;
  idNumber: string;
  itemName: string;
  agendaObjectItemOutlineNumber: string | null;
  agendaObjItemCategoryTypeDesc: string | null;
  agendaObjectItemDescription: string | null;
  isSection: boolean;
  customTextField8?: { name: string; value: string };
  recommendedActions: unknown[];
  attachmentsList: z.infer<typeof civicAttachmentSchema>[];
  childItems: StLouisCivicItem[] | null;
  [key: string]: unknown;
}

export const stLouisCivicMeetingSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    meetingDate: z.string(),
    files: z.array(civicFileSchema).default([]),
    items: z.array(stLouisCivicItemSchema).default([]),
  })
  .passthrough();

export type StLouisCivicMeeting = z.infer<typeof stLouisCivicMeetingSchema>;

export interface AdaptedStLouisItem {
  externalId: string;
  sequence: number;
  itemNumber: string | null;
  section: string | null;
  itemType: string;
  title: string;
  description: string | null;
  minutesNote: string | null;
  action: string | null;
  outcome: string | null;
  legislativeId: string | null;
  sponsors: string[];
  sourceVersion: string;
  contentHash: string;
  sourceUrl: string;
  documents: StLouisDocument[];
}

export function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlText(value: string): string {
  const spaced = value.replace(/<br\s*\/?\s*>/gi, " ");
  return cleanText(cheerio.load(`<div>${spaced}</div>`)("div").text());
}

function absoluteUrl(value: string, base = CITY_BASE): string {
  return new URL(value, base).toString();
}

function stableUrlKey(value: string): string {
  const url = new URL(value, CITY_BASE);
  return `${url.origin}${url.pathname}`;
}

function documentFromLink(
  href: string,
  type: StLouisDocument["type"],
  title: string,
  version = title,
): StLouisDocument {
  const url = absoluteUrl(href);
  const stable = stableUrlKey(url);
  return {
    externalId: `city:${hash(`${type}:${stable}`).slice(0, 24)}`,
    type,
    title: cleanText(title),
    url,
    sourceVersion: version,
    checksum: hash({ stable, version }),
  };
}

function selectedSession(html: string, selector: string): StLouisSession {
  const $ = cheerio.load(html);
  const option = $(`${selector} option[selected]`).first();
  const fallback = $(`${selector} option`).first();
  const selected = option.length > 0 ? option : fallback;
  const id = selected.attr("value")?.trim();
  const label = cleanText(selected.text());
  if (!id || !/^\d{4}-\d{4}$/.test(label)) {
    throw new Error("Unable to discover the active St. Louis session metadata");
  }
  return { id, label };
}

export function parseActiveAgendaSession(html: string): StLouisSession {
  return selectedSession(html, "#sessionYear");
}

export function parseActiveCalendarSession(html: string): StLouisSession {
  return selectedSession(html, "#session");
}

function parseUsDate(value: string): string {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) throw new Error(`Invalid St. Louis date: ${value}`);
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function centralOffset(date: string): "-05:00" | "-06:00" {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const nthSunday = (monthIndex: number, nth: number) => {
    const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (nth - 1) * 7;
  };
  const dstStart = nthSunday(2, 2);
  const dstEnd = nthSunday(10, 1);
  const daylight =
    (month > 3 && month < 11) ||
    (month === 3 && day >= dstStart) ||
    (month === 11 && day < dstEnd);
  return daylight ? "-05:00" : "-06:00";
}

export function parseStLouisStart(value: string): Date {
  const date = parseUsDate(value);
  const time = value.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!time) throw new Error(`Invalid St. Louis meeting time: ${value}`);
  let hour = Number(time[1]) % 12;
  if (time[3]!.toUpperCase() === "PM") hour += 12;
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${time[2]}:00${centralOffset(date)}`,
  );
}

export function parseStLouisCalendar(html: string): StLouisCalendarMeeting[] {
  parseActiveCalendarSession(html);
  const $ = cheerio.load(html);
  const civicIds = new Map<string, string>();
  const script = $.root().text() + $("script").text();
  const mapping =
    /const eventID = "(\d+)";\s*const eventDate = "[^"]*";\s*const civicPlusMeetingID = "([^"]*)";/g;
  for (const match of script.matchAll(mapping)) {
    if (match[2]) civicIds.set(match[1]!, match[2]);
  }

  const meetings = new Map<string, StLouisCalendarMeeting>();
  $(".event-list-details").each((_, element) => {
    const link = $(element).find('a[href*="Event_ID="]').first();
    const href = link.attr("href");
    if (!href) return;
    const canonicalUrl = absoluteUrl(href);
    const eventId = new URL(canonicalUrl).searchParams.get("Event_ID");
    if (!eventId) return;
    const dateText = cleanText($(element).find(".small").first().text());
    meetings.set(eventId, {
      eventId,
      civicClerkId: civicIds.get(eventId) ?? null,
      title: cleanText(link.text()),
      startsAt: parseStLouisStart(dateText),
      canonicalUrl,
    });
  });
  return [...meetings.values()].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
}

function typeForLabel(label: string): StLouisDocument["type"] | null {
  if (/agenda packet|packet/i.test(label)) return "packet";
  if (/agenda/i.test(label)) return "agenda";
  if (/minutes/i.test(label)) return "minutes";
  return null;
}

export function parseStLouisAgendaIndex(html: string): StLouisAgendaWeek[] {
  const session = parseActiveAgendaSession(html);
  const $ = cheerio.load(html);
  const rows: StLouisAgendaWeek[] = [];
  $("table tbody tr").each((_, row) => {
    const detailLink = $(row).find('a[href*="agendaViewID="]').first();
    const href = detailLink.attr("href");
    if (!href) return;
    const detailUrl = absoluteUrl(href, AGENDA_INDEX);
    const params = new URL(detailUrl).searchParams;
    const agendaViewId = params.get("agendaViewID");
    const rowSession = params.get("session");
    const week = Number(params.get("detail"));
    if (!agendaViewId || rowSession !== session.id || !Number.isInteger(week)) {
      return;
    }
    const documents: StLouisDocument[] = [];
    $(row)
      .find("a[href]")
      .each((__, anchor) => {
        if (anchor === detailLink.get(0)) return;
        const label = cleanText($(anchor).text());
        const type = typeForLabel(label);
        const documentHref = $(anchor).attr("href");
        if (type && documentHref) {
          documents.push(
            documentFromLink(
              documentHref,
              type,
              label,
              cleanText($(anchor).parent().text()),
            ),
          );
        }
      });
    rows.push({
      agendaViewId,
      sessionId: session.id,
      week,
      weekOf: parseUsDate(cleanText(detailLink.text())),
      detailUrl,
      documents,
    });
  });
  return rows;
}

function parseLegislationTable(
  $: cheerio.CheerioAPI,
  selector: string,
  kind: StLouisLegislationRef["kind"],
): StLouisLegislationRef[] {
  const legislation: StLouisLegislationRef[] = [];
  $(`${selector} tbody tr`).each((_, row) => {
    const cells = $(row).find("td");
    const link = cells.eq(0).find("a[href]").first();
    const href = link.attr("href");
    if (!href) return;
    const sourceUrl = absoluteUrl(href);
    const params = new URL(sourceUrl).searchParams;
    const externalId =
      kind === "board-bill" ? params.get("BBId") : params.get("rsId");
    if (!externalId) return;
    const cellText = cleanText(cells.eq(0).text());
    const number = cleanText(link.text());
    const title = cleanText(
      cellText.slice(cellText.indexOf(number) + number.length),
    );
    const sponsor = cleanText(cells.eq(1).text());
    legislation.push({
      kind,
      externalId,
      number,
      title,
      sponsors: sponsor ? [sponsor] : [],
      sourceUrl,
      documents: [],
    });
  });
  return legislation;
}

export function parseStLouisAgendaDetail(
  html: string,
  fallback: StLouisAgendaWeek,
): StLouisAgendaDetail {
  const $ = cheerio.load(html);
  const summary = cleanText($(".page-summary").first().text());
  const sessionLabel = summary.match(/Session\s+(\d{4}-\d{4})/i)?.[1];
  if (!sessionLabel)
    throw new Error(`Agenda ${fallback.agendaViewId} has no session metadata`);
  const eventHref = $(".event-list-details a")
    .filter((_, link) => /full board/i.test($(link).text()))
    .first()
    .attr("href");
  const eventId = eventHref
    ? new URL(absoluteUrl(eventHref)).searchParams.get("Event_ID")
    : null;
  const documents = [...fallback.documents];
  $(".download a[href]").each((_, link) => {
    const href = $(link).attr("href");
    const label = cleanText($(link).text());
    const type = typeForLabel(label);
    if (
      href &&
      type &&
      !documents.some(
        (document) => stableUrlKey(document.url) === stableUrlKey(href),
      )
    ) {
      documents.push(
        documentFromLink(href, type, label, cleanText($(link).parent().text())),
      );
    }
  });
  return {
    ...fallback,
    eventId,
    documents,
    legislation: [
      ...parseLegislationTable(
        $,
        'table[summary*="Board bills"]',
        "board-bill",
      ),
      ...parseLegislationTable(
        $,
        'table[summary*="Resolutions"]',
        "resolution",
      ),
    ],
  };
}

function legislationLinks($: cheerio.CheerioAPI): StLouisLegislationRef[] {
  const results = new Map<string, StLouisLegislationRef>();
  $('a[href*="boardbill.cfm"], a[href*="resolution.cfm"]').each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    const sourceUrl = absoluteUrl(href);
    const params = new URL(sourceUrl).searchParams;
    const isBill = params.has("BBId");
    const externalId = params.get(isBill ? "BBId" : "rsId");
    if (!externalId) return;
    const kind = isBill ? "board-bill" : "resolution";
    const text = cleanText($(link).text());
    const number = text.match(/(?:Number\s+)?([0-9]+[A-Z]*)$/i)?.[1] ?? text;
    results.set(`${kind}:${externalId}`, {
      kind,
      externalId,
      number,
      title: cleanText($(link).closest("p").next("p").text()),
      sponsors: [],
      sourceUrl,
      documents: [],
    });
  });
  return [...results.values()];
}

export function parseStLouisEventDetail(
  html: string,
  eventId: string,
): StLouisEventDetail {
  const $ = cheerio.load(html);
  const typeText = cleanText($(".MeetingType").text());
  const meetingType =
    typeText.match(/Type:\s*(Aldermanic[^]*?Meeting)/i)?.[1] ??
    "Aldermanic Meeting";
  const script = $("script").text();
  const civicClerkId =
    script.match(/const civicPlusMeetingID = "([^"]*)"/)?.[1] || null;
  const locationText = cleanText($("#contact").next().text());
  const location =
    locationText.match(/Location:\s*(.*?)(?:Contact|Hours|$)/i)?.[1]?.trim() ||
    null;
  const title = cleanText($("h1").first().text());
  const marker = `${title} ${$("#description").text()}`;
  const videoUrl = $("#EventDisplayBlock a[href]")
    .toArray()
    .map((link) => $(link).attr("href") ?? "")
    .find((href) => /(?:youtube\.com|youtu\.be|stltv\.net)/i.test(href));
  return {
    eventId,
    civicClerkId,
    title,
    meetingType: cleanText(meetingType),
    location,
    isCancelled: /\bcancel(?:led|ed|lation)?\b/i.test(marker),
    videoUrl: videoUrl ? absoluteUrl(videoUrl) : null,
    legislation: legislationLinks($),
  };
}

export function parseStLouisLegislationDetail(
  html: string,
  reference: StLouisLegislationRef,
): StLouisLegislationRef {
  const $ = cheerio.load(html);
  const heading = cleanText($("h1").first().text());
  const title = cleanText($(".page-summary").first().text()) || reference.title;
  const body = cleanText($(".content-block").text());
  const sponsorsText =
    body.match(/Primary Sponsors?:\s*(.*?)(?:Latest Activity|$)/i)?.[1] ?? "";
  const sponsors = $("strong")
    .filter((_, element) => /Primary Sponsors?/i.test($(element).text()))
    .parent()
    .find('a[href*="profile.cfm"]')
    .toArray()
    .map((link) => cleanText($(link).text()))
    .filter(Boolean);
  if (sponsors.length === 0 && sponsorsText)
    sponsors.push(cleanText(sponsorsText));
  const action = body
    .match(/Latest Activity:\s*(.*?)(?:Legislative History|$)/i)?.[1]
    ?.trim();
  const introduced = body.match(/Introduced:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1];
  const documents: StLouisDocument[] = [];
  $(".download a[href], .content-block a.pdf[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || !/\.pdf(?:$|\?)/i.test(href)) return;
    const label = cleanText($(link).text()) || `${reference.kind} text`;
    documents.push(
      documentFromLink(
        href,
        "bill-text",
        label,
        cleanText($(link).parent().text()),
      ),
    );
  });
  if (!heading.includes(reference.number)) {
    throw new Error(
      `Legislation ${reference.externalId} number changed unexpectedly`,
    );
  }
  return {
    ...reference,
    title,
    sponsors: sponsors.length > 0 ? sponsors : reference.sponsors,
    ...(action ? { action } : {}),
    ...(introduced
      ? { introducedAt: new Date(`${parseUsDate(introduced)}T12:00:00Z`) }
      : {}),
    documents,
  };
}

function civicDocument(
  file: z.infer<typeof civicFileSchema>,
): StLouisDocument | null {
  const type = typeForLabel(file.type);
  if (!type) return null;
  const sourceVersion = `${file.fileId}:${file.publishedOn}`;
  return {
    externalId: `civicclerk:${file.fileId}`,
    type,
    title: file.name || file.type,
    url: file.url,
    sourceVersion,
    checksum: hash({
      fileId: file.fileId,
      publishedOn: file.publishedOn,
      name: file.name,
    }),
  };
}

export function civicMeetingDocuments(input: unknown): StLouisDocument[] {
  return stLouisCivicMeetingSchema.parse(input).files.flatMap((file) => {
    const document = civicDocument(file);
    return document ? [document] : [];
  });
}

function legislativeNumber(text: string): {
  kind: StLouisLegislationRef["kind"];
  number: string;
} | null {
  const bill = text.match(/Board Bill(?: Number)?\s+([0-9]+[A-Z]*)/i);
  if (bill) return { kind: "board-bill", number: bill[1]! };
  const resolution = text.match(/Resolution(?: Number)?\s+([0-9]+[A-Z]*)/i);
  return resolution ? { kind: "resolution", number: resolution[1]! } : null;
}

export function adaptStLouisCivicItems(
  input: unknown,
  sourceUrl: string,
  legislation: StLouisLegislationRef[] = [],
): AdaptedStLouisItem[] {
  const meeting = stLouisCivicMeetingSchema.parse(input);
  const flattened: { item: StLouisCivicItem; section: string | null }[] = [];
  const visit = (items: StLouisCivicItem[], section: string | null) => {
    for (const item of items) {
      const title = htmlText(item.itemName);
      flattened.push({ item, section });
      visit(item.childItems ?? [], item.isSection ? title : section);
    }
  };
  visit(meeting.items, null);
  return flattened.map(({ item, section }, index) => {
    const rawTitle = htmlText(item.itemName);
    const marker = legislativeNumber(rawTitle);
    const law = marker
      ? legislation.find(
          (entry) =>
            entry.kind === marker.kind && entry.number === marker.number,
        )
      : undefined;
    const attachments = item.attachmentsList.map((attachment) => ({
      externalId: `civicclerk:${attachment.id}`,
      type: "attachment" as const,
      title: attachment.name,
      url: attachment.publicUrl,
      sourceVersion: String(attachment.id),
      checksum: hash({ id: attachment.id, name: attachment.name }),
    }));
    const itemType =
      law?.kind ??
      item.agendaObjItemCategoryTypeDesc ??
      (item.isSection ? "section" : "agenda-item");
    const title = law?.title || rawTitle || "Untitled agenda item";
    const mapped = {
      externalId: `civicclerk:${item.id}`,
      sequence: index,
      itemNumber: law?.number ?? (item.idNumber || null),
      section,
      itemType,
      title,
      description:
        cleanText(item.agendaObjectItemDescription ?? "") ||
        (law && rawTitle !== title ? rawTitle : null),
      minutesNote: cleanText(item.customTextField8?.value ?? "") || null,
      action: law?.action ?? null,
      outcome: null,
      legislativeId: law ? `${law.kind}:${law.externalId}` : null,
      sponsors: law?.sponsors ?? [],
      sourceUrl: law?.sourceUrl ?? sourceUrl,
      documents: [...attachments, ...(law?.documents ?? [])],
    };
    return {
      ...mapped,
      sourceVersion: `stlouis-civicclerk-v1:${hash(item).slice(0, 24)}`,
      contentHash: hash(mapped),
    };
  });
}

export function legislationAgendaItems(
  legislation: StLouisLegislationRef[],
  startingSequence: number,
): AdaptedStLouisItem[] {
  return legislation.map((law, index) => {
    const mapped = {
      externalId: `legislation:${law.kind}:${law.externalId}`,
      sequence: startingSequence + index,
      itemNumber: law.number,
      section: law.kind === "board-bill" ? "Board Bills" : "Resolutions",
      itemType: law.kind,
      title:
        law.title ||
        `${law.kind === "board-bill" ? "Board Bill" : "Resolution"} ${law.number}`,
      description: null,
      minutesNote: null,
      action: law.action ?? null,
      outcome: null,
      legislativeId: `${law.kind}:${law.externalId}`,
      sponsors: law.sponsors,
      sourceUrl: law.sourceUrl,
      documents: law.documents,
    };
    return {
      ...mapped,
      sourceVersion: `stlouis-legislation-v1:${hash(law).slice(0, 24)}`,
      contentHash: hash(mapped),
    };
  });
}
