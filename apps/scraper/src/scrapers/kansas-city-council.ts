import { createHash } from "node:crypto";
import pLimit from "p-limit";
import { z } from "zod/v4";

import { and, eq, notInArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalGovernmentAgendaItem,
  LocalGovernmentDocument,
  LocalGovernmentMeeting,
  LocalGovernmentVote,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { kansasCityCouncilConfig } from "./kansas-city-council.config.js";

const API_BASE = "https://webapi.legistar.com/v1/kansascity";
const SITE_BASE = "https://kansascity.legistar.com";
const SITE_GROUP = "D2E89A09-8736-4EFB-B4AE-572E0903BD5A";
const SITE_GROUP_ID = 821;
const PROVIDER = "legistar";
const JURISDICTION = "kansas-city-mo";
const COUNCIL_BODY_ID = 138;
const SOURCE_VERSION = "kansas-city-legistar-v1";
const TIMEZONE = "America/Chicago";
const DEFAULT_MAX_ITEMS = 250;
const USER_AGENT =
  "Billion civic data scraper (+https://github.com/billion-app/billion)";
const logger = createLogger(kansasCityCouncilConfig.name);

const attachmentSchema = z
  .object({
    MatterAttachmentId: z.number(),
    MatterAttachmentLastModifiedUtc: z.string(),
    MatterAttachmentRowVersion: z.string(),
    MatterAttachmentName: z.string(),
    MatterAttachmentHyperlink: z.string().nullable(),
    MatterAttachmentShowOnInternetPage: z.boolean().optional(),
  })
  .passthrough();

export const kansasCityEventSchema = z
  .object({
    EventId: z.number(),
    EventGuid: z.string(),
    EventLastModifiedUtc: z.string(),
    EventRowVersion: z.string(),
    EventBodyId: z.number(),
    EventBodyName: z.string(),
    EventDate: z.string(),
    EventTime: z.string().nullable(),
    EventAgendaStatusName: z.string().nullable(),
    EventMinutesStatusName: z.string().nullable(),
    EventLocation: z.string().nullable(),
    EventAgendaFile: z.string().nullable(),
    EventMinutesFile: z.string().nullable(),
    EventAgendaLastPublishedUTC: z.string().nullable().optional(),
    EventMinutesLastPublishedUTC: z.string().nullable().optional(),
    EventComment: z.string().nullable(),
    EventVideoPath: z.string().nullable(),
    EventMedia: z.union([z.string(), z.number()]).nullable().optional(),
    EventInSiteURL: z.string().nullable(),
  })
  .passthrough();

export const kansasCityItemSchema = z
  .object({
    EventItemId: z.number(),
    EventItemLastModifiedUtc: z.string(),
    EventItemRowVersion: z.string(),
    EventItemEventId: z.number(),
    EventItemAgendaSequence: z.number(),
    EventItemAgendaNumber: z.string().nullable(),
    EventItemVersion: z.string().nullable().optional(),
    EventItemAgendaNote: z.string().nullable(),
    EventItemMinutesNote: z.string().nullable(),
    EventItemActionId: z.number().nullable(),
    EventItemActionName: z.string().nullable(),
    EventItemActionText: z.string().nullable(),
    EventItemPassedFlagName: z.string().nullable(),
    EventItemRollCallFlag: z.number().nullable(),
    EventItemTitle: z.string().nullable(),
    EventItemTally: z.string().nullable(),
    EventItemConsent: z.number(),
    EventItemMover: z.string().nullable(),
    EventItemSeconder: z.string().nullable(),
    EventItemMatterId: z.number().nullable(),
    EventItemMatterGuid: z.string().nullable(),
    EventItemMatterFile: z.string().nullable(),
    EventItemMatterName: z.string().nullable(),
    EventItemMatterType: z.string().nullable(),
    EventItemMatterStatus: z.string().nullable(),
    EventItemMatterAttachments: z.array(attachmentSchema).nullable(),
  })
  .passthrough();

export const kansasCityVoteSchema = z
  .object({
    VoteId: z.number(),
    VoteLastModifiedUtc: z.string(),
    VotePersonId: z.number(),
    VotePersonName: z.string(),
    VoteValueName: z.string(),
    VoteSort: z.number(),
    VoteEventItemId: z.number(),
  })
  .passthrough();

type KansasCityEvent = z.infer<typeof kansasCityEventSchema>;
type KansasCityItem = z.infer<typeof kansasCityItemSchema>;
type KansasCityVote = z.infer<typeof kansasCityVoteSchema>;
type DocumentType = "agenda" | "packet" | "minutes" | "attachment";

interface KansasCityDocument {
  type: DocumentType;
  title: string;
  url: string;
  mediaType: string | null;
  checksum: string;
}

interface EnrichedItem {
  item: ReturnType<typeof adaptKansasCityItem>;
  votes: ReturnType<typeof adaptKansasCityVote>[] | undefined;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function datePart(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid Legistar date: ${value}`);
  return match[1]!;
}

function nthSunday(year: number, monthIndex: number, nth: number): number {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (nth - 1) * 7;
}

function centralUtcOffset(date: string): "-05:00" | "-06:00" {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const dstStart = nthSunday(year, 2, 2);
  const dstEnd = nthSunday(year, 10, 1);
  const isDst =
    (month > 3 && month < 11) ||
    (month === 3 && day >= dstStart) ||
    (month === 11 && day < dstEnd);
  return isDst ? "-05:00" : "-06:00";
}

export function parseKansasCityStart(
  eventDate: string,
  eventTime: string | null,
): Date {
  const date = datePart(eventDate);
  const match = eventTime?.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  let hour = 0;
  let minute = 0;
  if (match) {
    hour = Number(match[1]) % 12;
    minute = Number(match[2]);
    if (match[3]!.toUpperCase() === "PM") hour += 12;
  }
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${centralUtcOffset(date)}`,
  );
}

/** Kansas City Council terms start August 1 every four years (2023 anchor). */
export function currentKansasCityCouncilCycleStart(now = new Date()): Date {
  const anchorYear = 2023;
  const year = now.getUTCFullYear();
  let startYear = anchorYear + Math.floor((year - anchorYear) / 4) * 4;
  const candidate = new Date(Date.UTC(startYear, 7, 1));
  if (candidate > now) startYear -= 4;
  return new Date(Date.UTC(startYear, 7, 1));
}

function mediaType(url: string): string | null {
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return null;
}

function meetingDocuments(
  event: KansasCityEvent,
  isAmended: boolean,
): KansasCityDocument[] {
  const documents: KansasCityDocument[] = [];
  if (event.EventAgendaFile) {
    documents.push({
      type: "agenda",
      title: `${isAmended ? "Revised " : ""}Agenda`,
      url: event.EventAgendaFile,
      mediaType: mediaType(event.EventAgendaFile),
      checksum: hash({
        url: event.EventAgendaFile,
        publishedAt: event.EventAgendaLastPublishedUTC,
        rowVersion: event.EventRowVersion,
      }),
    });
  }
  if (event.EventMinutesFile) {
    documents.push({
      type: "minutes",
      title: /revis/i.test(event.EventMinutesStatusName ?? "")
        ? "Revised Minutes"
        : "Minutes",
      url: event.EventMinutesFile,
      mediaType: mediaType(event.EventMinutesFile),
      checksum: hash({
        url: event.EventMinutesFile,
        publishedAt: event.EventMinutesLastPublishedUTC,
        rowVersion: event.EventRowVersion,
      }),
    });
  }
  return documents;
}

function videoUrl(event: KansasCityEvent): string | null {
  if (event.EventVideoPath) {
    return new URL(event.EventVideoPath, SITE_BASE).toString();
  }
  if (!event.EventMedia) return null;
  return `${SITE_BASE}/Video.aspx?Mode=Granicus&ID1=${event.EventMedia}&G=${SITE_GROUP}&Mode2=Video`;
}

function markerText(event: KansasCityEvent): string {
  return [
    event.EventComment,
    event.EventAgendaStatusName,
    event.EventMinutesStatusName,
    event.EventAgendaFile,
    event.EventMinutesFile,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isDiscoverableKansasCityEvent(input: unknown): boolean {
  const event = kansasCityEventSchema.parse(input);
  return (
    event.EventBodyId === COUNCIL_BODY_ID &&
    !/hidden/i.test(event.EventAgendaStatusName ?? "") &&
    !/^test meeting$/i.test(event.EventComment?.trim() ?? "")
  );
}

export function adaptKansasCityMeeting(input: unknown) {
  const event = kansasCityEventSchema.parse(input);
  const markers = markerText(event);
  const isCancelled = /\bcancel(?:led|ed|lation)?\b/i.test(markers);
  const isAmended = /\b(amend(?:ed|ment)?|revis(?:ed|ion)|corrected)\b/i.test(
    markers,
  );
  const isSpecial = /\bspecial\b/i.test(markers);
  const meetingType = isSpecial ? "Special Meeting" : "Regular Meeting";
  const sourceUrl =
    event.EventInSiteURL ??
    `${SITE_BASE}/MeetingDetail.aspx?LEGID=${event.EventId}&GID=${SITE_GROUP_ID}&G=${SITE_GROUP}`;
  const mapped = {
    source: PROVIDER,
    jurisdiction: JURISDICTION,
    externalId: String(event.EventId),
    governingBody: event.EventBodyName,
    title: `${event.EventBodyName} ${meetingType}`,
    meetingType,
    startsAt: parseKansasCityStart(event.EventDate, event.EventTime),
    timezone: TIMEZONE,
    location: event.EventLocation,
    status: isCancelled
      ? "cancelled"
      : (event.EventMinutesStatusName ??
        event.EventAgendaStatusName ??
        "scheduled"),
    isCancelled,
    isAmended,
    canonicalUrl: sourceUrl,
    videoUrl: videoUrl(event),
    documents: meetingDocuments(event, isAmended),
    sourceVersion: `${SOURCE_VERSION}:${event.EventRowVersion}`,
    sourceUpdatedAt: new Date(event.EventLastModifiedUtc),
  };
  return { ...mapped, contentHash: hash(mapped) };
}

function attachmentDocuments(item: KansasCityItem): KansasCityDocument[] {
  return (item.EventItemMatterAttachments ?? [])
    .filter(
      (attachment) =>
        attachment.MatterAttachmentHyperlink &&
        attachment.MatterAttachmentShowOnInternetPage !== false,
    )
    .map((attachment) => {
      const url = attachment.MatterAttachmentHyperlink!;
      const isPacket = /\bagenda\s+packet\b/i.test(
        attachment.MatterAttachmentName,
      );
      return {
        type: isPacket ? ("packet" as const) : ("attachment" as const),
        title: attachment.MatterAttachmentName,
        url,
        mediaType: mediaType(url),
        checksum: hash({
          id: attachment.MatterAttachmentId,
          rowVersion: attachment.MatterAttachmentRowVersion,
          updatedAt: attachment.MatterAttachmentLastModifiedUtc,
          url,
        }),
      };
    });
}

export function adaptKansasCityItem(input: unknown) {
  const item = kansasCityItemSchema.parse(input);
  const title = item.EventItemTitle?.trim() || "Untitled agenda item";
  const isSection =
    !item.EventItemMatterId && !item.EventItemActionId && /:\s*$/.test(title);
  const mapped = {
    externalId: String(item.EventItemId),
    meetingExternalId: String(item.EventItemEventId),
    sequence: item.EventItemAgendaSequence,
    itemNumber: item.EventItemMatterFile ?? item.EventItemAgendaNumber,
    section: isSection ? title.replace(/:\s*$/, "") : null,
    itemType:
      item.EventItemMatterType ?? (isSection ? "section" : "agenda-item"),
    title,
    description: item.EventItemAgendaNote,
    minutesNote: item.EventItemMinutesNote,
    consent: item.EventItemConsent === 1,
    action: item.EventItemActionName,
    motion: item.EventItemActionText,
    outcome: item.EventItemPassedFlagName ?? item.EventItemMatterStatus,
    voteSummary: item.EventItemTally,
    mover: item.EventItemMover,
    seconder: item.EventItemSeconder,
    matterId: item.EventItemMatterId,
    matterGuid: item.EventItemMatterGuid,
    documents: attachmentDocuments(item),
    shouldFetchVotes:
      item.EventItemRollCallFlag === 1 || item.EventItemActionId !== null,
    sourceVersion: `${SOURCE_VERSION}:${item.EventItemRowVersion}`,
    sourceUpdatedAt: new Date(item.EventItemLastModifiedUtc),
    sourceUrl: `${SITE_BASE}/MeetingDetail.aspx?LEGID=${item.EventItemEventId}&GID=${SITE_GROUP_ID}&G=${SITE_GROUP}`,
  };
  return { ...mapped, contentHash: hash(mapped) };
}

export function adaptKansasCityVote(input: unknown) {
  const vote = kansasCityVoteSchema.parse(input);
  return {
    externalId: String(vote.VoteId),
    itemExternalId: String(vote.VoteEventItemId),
    voterExternalId: String(vote.VotePersonId),
    voterName: vote.VotePersonName,
    value: vote.VoteValueName,
    sort: vote.VoteSort,
    sourceUpdatedAt: new Date(vote.VoteLastModifiedUtc),
  };
}

function summarizeVotes(
  votes: ReturnType<typeof adaptKansasCityVote>[],
): string | null {
  if (votes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.value, (counts.get(vote.value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => `${count} ${value}`)
    .join(", ");
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetchWithRetry(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    timeoutMs: 30_000,
  });
  return response.json() as Promise<unknown>;
}

async function fetchVotes(
  item: ReturnType<typeof adaptKansasCityItem>,
): Promise<ReturnType<typeof adaptKansasCityVote>[] | undefined> {
  if (!item.shouldFetchVotes) return undefined;
  try {
    const url = new URL(`${API_BASE}/EventItems/${item.externalId}/Votes`);
    return z
      .array(z.unknown())
      .parse(await fetchJson(url))
      .flatMap((raw) => {
        const vote = kansasCityVoteSchema.safeParse(raw);
        if (!vote.success) {
          logger.warn(`Skipping invalid vote for item ${item.externalId}`);
          return [];
        }
        return [adaptKansasCityVote(vote.data)];
      });
  } catch (error) {
    logger.warn(`Votes unavailable for item ${item.externalId}`, error);
    return undefined;
  }
}

function dedupeDocuments(documents: KansasCityDocument[]) {
  return [
    ...new Map(documents.map((document) => [document.url, document])).values(),
  ];
}

async function persistMeeting(
  meeting: ReturnType<typeof adaptKansasCityMeeting>,
  enrichedItems: EnrichedItem[],
): Promise<void> {
  const fetchedAt = new Date();
  const documents = dedupeDocuments([
    ...meeting.documents,
    ...enrichedItems.flatMap(({ item }) => item.documents),
  ]);
  const contentHash = hash({
    meeting: meeting.contentHash,
    documents: documents.map(({ type, url, checksum }) => ({
      type,
      url,
      checksum,
    })),
    items: enrichedItems.map(({ item, votes }) => ({
      hash: item.contentHash,
      votes,
    })),
  });
  const {
    documents: _meetingDocuments,
    contentHash: _baseHash,
    ...meetingRow
  } = meeting;

  await db.transaction(async (tx) => {
    const [storedMeeting] = await tx
      .insert(LocalGovernmentMeeting)
      .values({ ...meetingRow, contentHash, fetchedAt })
      .onConflictDoUpdate({
        target: [
          LocalGovernmentMeeting.source,
          LocalGovernmentMeeting.jurisdiction,
          LocalGovernmentMeeting.externalId,
        ],
        set: { ...meetingRow, contentHash, fetchedAt, updatedAt: fetchedAt },
      })
      .returning({ id: LocalGovernmentMeeting.id });
    if (!storedMeeting)
      throw new Error(`Failed to persist meeting ${meeting.externalId}`);

    await tx
      .update(LocalGovernmentDocument)
      .set({ isCurrent: false, updatedAt: fetchedAt })
      .where(eq(LocalGovernmentDocument.meetingId, storedMeeting.id));

    for (const document of documents) {
      await tx
        .insert(LocalGovernmentDocument)
        .values({
          meetingId: storedMeeting.id,
          type: document.type,
          title: document.title,
          url: document.url,
          mediaType: document.mediaType,
          checksum: document.checksum,
          isCurrent: true,
          fetchedAt,
        })
        .onConflictDoUpdate({
          target: [
            LocalGovernmentDocument.meetingId,
            LocalGovernmentDocument.type,
            LocalGovernmentDocument.url,
          ],
          set: {
            title: document.title,
            mediaType: document.mediaType,
            checksum: document.checksum,
            isCurrent: true,
            fetchedAt,
            updatedAt: fetchedAt,
          },
        });
    }

    for (const enriched of enrichedItems) {
      const { item, votes } = enriched;
      const voteSummary = item.voteSummary ?? summarizeVotes(votes ?? []);
      const itemRow = {
        externalId: item.externalId,
        sequence: item.sequence,
        itemNumber: item.itemNumber,
        section: item.section,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        minutesNote: item.minutesNote,
        consent: item.consent,
        action: item.action,
        motion: item.motion,
        outcome: item.outcome,
        voteSummary,
        mover: item.mover,
        seconder: item.seconder,
        sourceVersion: item.sourceVersion,
        contentHash: item.contentHash,
        sourceUpdatedAt: item.sourceUpdatedAt,
        sourceUrl: item.sourceUrl,
      };
      const [storedItem] = await tx
        .insert(LocalGovernmentAgendaItem)
        .values({ ...itemRow, meetingId: storedMeeting.id })
        .onConflictDoUpdate({
          target: [
            LocalGovernmentAgendaItem.meetingId,
            LocalGovernmentAgendaItem.externalId,
          ],
          set: { ...itemRow, updatedAt: fetchedAt },
        })
        .returning({ id: LocalGovernmentAgendaItem.id });
      if (!storedItem)
        throw new Error(`Failed to persist item ${item.externalId}`);

      // An unavailable vote endpoint preserves the last known roll call.
      if (votes === undefined) continue;
      await tx
        .delete(LocalGovernmentVote)
        .where(eq(LocalGovernmentVote.agendaItemId, storedItem.id));
      if (votes.length > 0) {
        await tx.insert(LocalGovernmentVote).values(
          votes.map((vote) => ({
            agendaItemId: storedItem.id,
            externalId: vote.externalId,
            voterExternalId: vote.voterExternalId,
            voterName: vote.voterName,
            value: vote.value,
            sort: vote.sort,
            sourceUpdatedAt: vote.sourceUpdatedAt,
            fetchedAt,
          })),
        );
      }
    }

    const staleItemFilter =
      enrichedItems.length === 0
        ? eq(LocalGovernmentAgendaItem.meetingId, storedMeeting.id)
        : and(
            eq(LocalGovernmentAgendaItem.meetingId, storedMeeting.id),
            notInArray(
              LocalGovernmentAgendaItem.externalId,
              enrichedItems.map(({ item }) => item.externalId),
            ),
          );
    await tx.delete(LocalGovernmentAgendaItem).where(staleItemFilter);
  });
}

async function scrapeMeeting(rawEvent: unknown): Promise<void> {
  const meeting = adaptKansasCityMeeting(rawEvent);
  const itemsUrl = new URL(
    `${API_BASE}/Events/${meeting.externalId}/EventItems`,
  );
  itemsUrl.searchParams.set("AgendaNote", "1");
  itemsUrl.searchParams.set("MinutesNote", "1");
  itemsUrl.searchParams.set("Attachments", "1");
  const rawItems = z.array(z.unknown()).parse(await fetchJson(itemsUrl));
  const items = rawItems.flatMap((rawItem) => {
    const parsed = kansasCityItemSchema.safeParse(rawItem);
    if (!parsed.success) {
      logger.warn(`Skipping invalid item for meeting ${meeting.externalId}`);
      return [];
    }
    return [adaptKansasCityItem(parsed.data)];
  });

  // Kansas City stores votes on actioned items even when RollCallFlag is zero.
  // Two concurrent vote requests keeps pressure on the public host conservative.
  const voteLimit = pLimit(2);
  const enrichedItems = await Promise.all(
    items.map(async (item) => ({
      item,
      votes: await voteLimit(() => fetchVotes(item)),
    })),
  );
  await persistMeeting(meeting, enrichedItems);
  logger.success(`Synced ${meeting.title} (${meeting.externalId})`);
}

async function scrape(maxItems = DEFAULT_MAX_ITEMS): Promise<void> {
  const start = currentKansasCityCouncilCycleStart();
  const end = new Date(Date.UTC(start.getUTCFullYear() + 4, 7, 1));
  const eventsUrl = new URL(`${API_BASE}/Events`);
  eventsUrl.searchParams.set(
    "$filter",
    `EventDate ge datetime'${start.toISOString().slice(0, 10)}' and EventDate lt datetime'${end.toISOString().slice(0, 10)}' and EventBodyId eq ${COUNCIL_BODY_ID}`,
  );
  eventsUrl.searchParams.set("$orderby", "EventDate asc");
  eventsUrl.searchParams.set("$top", String(maxItems));

  logger.info(
    `Syncing Council term from ${start.toISOString().slice(0, 10)} (structured source; no archive backfill)`,
  );
  const rawEvents = z
    .array(z.unknown())
    .parse(await fetchJson(eventsUrl))
    .filter(isDiscoverableKansasCityEvent)
    .slice(0, maxItems);
  setExpectedTotal(rawEvents.length);

  // Meetings are intentionally sequential. Only vote lookups within one
  // meeting run concurrently, capped above at two requests.
  for (const rawEvent of rawEvents) {
    try {
      await scrapeMeeting(rawEvent);
    } catch (error) {
      const parsed = kansasCityEventSchema.safeParse(rawEvent);
      logger.error(
        `Meeting ${parsed.success ? parsed.data.EventId : "unknown"} failed without aborting run`,
        error,
      );
    }
  }
  logger.success(`Completed ${rawEvents.length} Kansas City Council meetings`);
}

export const kansasCityCouncil: Scraper = {
  ...kansasCityCouncilConfig,
  scrape: (options) =>
    scrape(
      (options?.maxItems ??
        Number(process.env.KANSAS_CITY_COUNCIL_MAX_ITEMS)) ||
        DEFAULT_MAX_ITEMS,
    ),
};
