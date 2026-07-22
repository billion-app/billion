import { createHash } from "node:crypto";
import { z } from "zod/v4";

import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalGovernmentAgendaItem,
  LocalGovernmentDocument,
  LocalGovernmentMeeting,
  LocalGovernmentVote,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { durhamBoccConfig } from "./durham-bocc.config.js";

const API_BASE = "https://webapi.legistar.com/v1/durhamcounty";
const SITE_BASE = "https://durhamcounty.legistar.com";
const PROVIDER = "legistar";
const JURISDICTION = "durham-county-nc";
const BOCC_BODY_ID = 138;
const SOURCE_VERSION = "durham-legistar-v1";
const TIMEZONE = "America/New_York";
const logger = createLogger(durhamBoccConfig.name);

const attachmentSchema = z
  .object({
    MatterAttachmentId: z.number(),
    MatterAttachmentName: z.string(),
    MatterAttachmentHyperlink: z.string().nullable(),
    MatterAttachmentLastModifiedUtc: z.string(),
    MatterAttachmentShowOnInternetPage: z.boolean().optional(),
  })
  .passthrough();

export const durhamEventSchema = z
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
    EventComment: z.string().nullable(),
    EventVideoPath: z.string().nullable(),
    EventMedia: z.union([z.string(), z.number()]).nullable().optional(),
    EventInSiteURL: z.string().nullable(),
  })
  .passthrough();

export const durhamItemSchema = z
  .object({
    EventItemId: z.number(),
    EventItemLastModifiedUtc: z.string(),
    EventItemRowVersion: z.string(),
    EventItemEventId: z.number(),
    EventItemAgendaSequence: z.number(),
    EventItemAgendaNumber: z.string().nullable(),
    EventItemAgendaNote: z.string().nullable(),
    EventItemMinutesNote: z.string().nullable(),
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
    EventItemMatterAttachments: z.array(attachmentSchema).nullable(),
  })
  .passthrough();

export const durhamVoteSchema = z
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

type DurhamEvent = z.infer<typeof durhamEventSchema>;
type DurhamItem = z.infer<typeof durhamItemSchema>;
type DurhamVote = z.infer<typeof durhamVoteSchema>;
interface DurhamDocument {
  kind: "agenda" | "minutes" | "attachment";
  title: string;
  url: string;
  language?: string;
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

function easternUtcOffset(date: string): "-04:00" | "-05:00" {
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
  return isDst ? "-04:00" : "-05:00";
}

export function parseDurhamStart(
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
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${easternUtcOffset(date)}`,
  );
}

export function currentElectionCycleStart(now = new Date()): Date {
  const year = now.getUTCFullYear();
  const startYear = year % 2 === 0 ? year - 1 : year;
  return new Date(Date.UTC(startYear, 0, 1));
}

function documentLanguage(title: string): string | undefined {
  return /\b(spanish|español|espanol)\b/i.test(title) ? "es" : undefined;
}

function visibleAttachmentDocuments(
  item: DurhamItem,
): DurhamDocument[] {
  const kind = /\bminutes?\b/i.test(item.EventItemTitle ?? "")
    ? ("minutes" as const)
    : ("attachment" as const);
  return (item.EventItemMatterAttachments ?? [])
    .filter(
      (attachment) =>
        attachment.MatterAttachmentHyperlink &&
        attachment.MatterAttachmentShowOnInternetPage !== false,
    )
    .map((attachment) => ({
      kind,
      title: attachment.MatterAttachmentName,
      url: attachment.MatterAttachmentHyperlink!,
      ...(documentLanguage(attachment.MatterAttachmentName)
        ? { language: documentLanguage(attachment.MatterAttachmentName) }
        : {}),
    }));
}

export function adaptDurhamMeeting(input: unknown) {
  const event = durhamEventSchema.parse(input);
  const comment = event.EventComment?.trim() || "Board meeting";
  const markerText = [
    comment,
    event.EventAgendaStatusName,
    event.EventMinutesStatusName,
    event.EventAgendaFile,
    event.EventMinutesFile,
  ]
    .filter(Boolean)
    .join(" ");
  const isCancelled = /\bcancel(?:led|ed|lation)?\b/i.test(markerText);
  const isAmended = /\b(amend(?:ed|ment)?|revis(?:ed|ion)|corrected)\b/i.test(
    markerText,
  );
  const documents: DurhamDocument[] = [];
  if (event.EventAgendaFile) {
    documents.push({
      kind: "agenda",
      title: `${isAmended ? "Amended " : ""}Agenda`,
      url: event.EventAgendaFile,
    });
  }
  if (event.EventMinutesFile) {
    documents.push({
      kind: "minutes",
      title: "Minutes",
      url: event.EventMinutesFile,
    });
  }
  const sourceUrl =
    event.EventInSiteURL ??
    `${SITE_BASE}/MeetingDetail.aspx?LEGID=${event.EventId}`;
  const videoUrl = event.EventVideoPath
    ? event.EventVideoPath
    : event.EventMedia
      ? `${SITE_BASE}/Video.aspx?Mode=Granicus&ID1=${event.EventMedia}&Mode2=Video`
      : null;
  const status = isCancelled
    ? "cancelled"
    : (event.EventMinutesStatusName ??
      event.EventAgendaStatusName ??
      "scheduled");
  const mapped = {
    source: PROVIDER,
    jurisdiction: JURISDICTION,
    externalId: String(event.EventId),
    governingBody: event.EventBodyName,
    title: comment,
    meetingType: comment.replace(/^cancel(?:led|ed)\s*-?\s*/i, ""),
    startsAt: parseDurhamStart(event.EventDate, event.EventTime),
    timezone: TIMEZONE,
    location: event.EventLocation,
    status,
    isCancelled,
    isAmended,
    canonicalUrl: sourceUrl,
    videoUrl,
    documents,
    sourceVersion: `${SOURCE_VERSION}:${event.EventRowVersion}`,
    sourceUpdatedAt: new Date(event.EventLastModifiedUtc),
  };
  return { ...mapped, contentHash: hash(mapped) };
}

export function adaptDurhamItem(input: unknown) {
  const item = durhamItemSchema.parse(input);
  const mapped = {
    externalId: String(item.EventItemId),
    meetingExternalId: String(item.EventItemEventId),
    sequence: item.EventItemAgendaSequence,
    itemNumber: item.EventItemAgendaNumber,
    itemType: item.EventItemActionName ?? "agenda-item",
    title: item.EventItemTitle?.trim() || "Untitled agenda item",
    description: item.EventItemAgendaNote,
    minutesNote: item.EventItemMinutesNote,
    consent: item.EventItemConsent === 1,
    action: item.EventItemActionName,
    motion: item.EventItemActionText,
    outcome: item.EventItemPassedFlagName,
    voteSummary: item.EventItemTally,
    mover: item.EventItemMover,
    seconder: item.EventItemSeconder,
    documents: visibleAttachmentDocuments(item),
    sourceVersion: `${SOURCE_VERSION}:${item.EventItemRowVersion}`,
    sourceUpdatedAt: new Date(item.EventItemLastModifiedUtc),
    sourceUrl: `${SITE_BASE}/MeetingDetail.aspx?LEGID=${item.EventItemEventId}&GID=174`,
  };
  return { ...mapped, contentHash: hash(mapped) };
}

export function adaptDurhamVote(input: unknown) {
  const vote = durhamVoteSchema.parse(input);
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

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetchWithRetry(url.toString(), { timeoutMs: 30_000 });
  return response.json() as Promise<unknown>;
}

async function upsertMeeting(meeting: ReturnType<typeof adaptDurhamMeeting>) {
  const fetchedAt = new Date();
  const { documents, ...meetingRow } = meeting;
  const [stored] = await db
    .insert(LocalGovernmentMeeting)
    .values({ ...meetingRow, fetchedAt })
    .onConflictDoUpdate({
      target: [
        LocalGovernmentMeeting.source,
        LocalGovernmentMeeting.jurisdiction,
        LocalGovernmentMeeting.externalId,
      ],
      set: { ...meetingRow, fetchedAt },
    })
    .returning({ id: LocalGovernmentMeeting.id });
  if (!stored) throw new Error(`Failed to persist meeting ${meeting.externalId}`);
  await upsertDocuments(stored.id, documents);
  return stored.id;
}

async function upsertDocuments(
  meetingId: string,
  documents: DurhamDocument[],
) {
  for (const document of documents) {
    await db
      .insert(LocalGovernmentDocument)
      .values({
        meetingId,
        type: document.kind,
        title: document.language
          ? `${document.title} (${document.language})`
          : document.title,
        url: document.url,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          LocalGovernmentDocument.meetingId,
          LocalGovernmentDocument.type,
          LocalGovernmentDocument.url,
        ],
        set: {
          title: document.language
            ? `${document.title} (${document.language})`
            : document.title,
          isCurrent: true,
          fetchedAt: new Date(),
        },
      });
  }
}

async function upsertItem(
  meetingId: string,
  item: ReturnType<typeof adaptDurhamItem>,
) {
  const { documents } = item;
  const itemRow = {
    externalId: item.externalId,
    sequence: item.sequence,
    itemNumber: item.itemNumber,
    itemType: item.itemType,
    title: item.title,
    description: item.description,
    minutesNote: item.minutesNote,
    consent: item.consent,
    action: item.action,
    motion: item.motion,
    outcome: item.outcome,
    voteSummary: item.voteSummary,
    mover: item.mover,
    seconder: item.seconder,
    sourceVersion: item.sourceVersion,
    contentHash: item.contentHash,
    sourceUpdatedAt: item.sourceUpdatedAt,
    sourceUrl: item.sourceUrl,
  };
  const [stored] = await db
    .insert(LocalGovernmentAgendaItem)
    .values({ ...itemRow, meetingId })
    .onConflictDoUpdate({
      target: [
        LocalGovernmentAgendaItem.meetingId,
        LocalGovernmentAgendaItem.externalId,
      ],
      set: itemRow,
    })
    .returning({ id: LocalGovernmentAgendaItem.id });
  if (!stored) throw new Error(`Failed to persist item ${item.externalId}`);
  await upsertDocuments(meetingId, documents);
  return stored.id;
}

async function upsertVote(
  agendaItemId: string,
  vote: ReturnType<typeof adaptDurhamVote>,
) {
  const voteRow = {
    externalId: vote.externalId,
    voterExternalId: vote.voterExternalId,
    voterName: vote.voterName,
    value: vote.value,
    sort: vote.sort,
    sourceUpdatedAt: vote.sourceUpdatedAt,
  };
  await db
    .insert(LocalGovernmentVote)
    .values({ ...voteRow, agendaItemId, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [LocalGovernmentVote.agendaItemId, LocalGovernmentVote.voterName],
      set: { ...voteRow, fetchedAt: new Date() },
    });
}

async function scrapeMeeting(rawEvent: unknown): Promise<void> {
  const meeting = adaptDurhamMeeting(rawEvent);
  const meetingId = await upsertMeeting(meeting);

  const itemsUrl = new URL(
    `${API_BASE}/Events/${meeting.externalId}/EventItems`,
  );
  itemsUrl.searchParams.set("AgendaNote", "1");
  itemsUrl.searchParams.set("MinutesNote", "1");
  itemsUrl.searchParams.set("Attachments", "1");
  const rawItems = z.array(z.unknown()).parse(await fetchJson(itemsUrl));

  for (const rawItem of rawItems) {
    try {
      const parsed = durhamItemSchema.parse(rawItem);
      let enrichedItem: unknown = rawItem;
      if (
        parsed.EventItemMatterId &&
        (parsed.EventItemMatterAttachments?.length ?? 0) === 0
      ) {
        try {
          const attachmentsUrl = new URL(
            `${API_BASE}/Matters/${parsed.EventItemMatterId}/Attachments`,
          );
          const attachments = z
            .array(attachmentSchema)
            .parse(await fetchJson(attachmentsUrl));
          enrichedItem = {
            ...parsed,
            EventItemMatterAttachments: attachments,
          };
        } catch (error) {
          logger.warn(
            `Attachments unavailable for matter ${parsed.EventItemMatterId}`,
            error,
          );
        }
      }
      const item = adaptDurhamItem(enrichedItem);
      const agendaItemId = await upsertItem(meetingId, item);
      if (parsed.EventItemRollCallFlag === 1) {
        const votesUrl = new URL(
          `${API_BASE}/EventItems/${item.externalId}/Votes`,
        );
        const rawVotes = z.array(z.unknown()).parse(await fetchJson(votesUrl));
        for (const rawVote of rawVotes) {
          try {
            await upsertVote(agendaItemId, adaptDurhamVote(rawVote));
          } catch (error) {
            logger.warn(
              `Skipping invalid vote for item ${item.externalId}`,
              error,
            );
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Skipping invalid item for meeting ${meeting.externalId}`,
        error,
      );
    }
  }

  logger.success(`Synced ${meeting.title} (${meeting.externalId})`);
}

async function scrape(maxItems = 100): Promise<void> {
  const start = currentElectionCycleStart();
  const eventsUrl = new URL(`${API_BASE}/Events`);
  eventsUrl.searchParams.set(
    "$filter",
    `EventDate ge datetime'${start.toISOString().slice(0, 10)}' and EventBodyId eq ${BOCC_BODY_ID}`,
  );
  eventsUrl.searchParams.set("$orderby", "EventDate asc");
  eventsUrl.searchParams.set("$top", String(maxItems));

  logger.info(
    `Syncing current election cycle from ${start.toISOString().slice(0, 10)} (structured source; OCR not required)`,
  );
  const rawEvents = z
    .array(z.unknown())
    .parse(await fetchJson(eventsUrl))
    .slice(0, maxItems);
  setExpectedTotal(rawEvents.length);

  const limit = getItemLimit();
  const results = await Promise.allSettled(
    rawEvents.map((rawEvent) =>
      limit(async () => {
        try {
          await scrapeMeeting(rawEvent);
        } catch (error) {
          let sourceId = "unknown";
          const parsed = durhamEventSchema.safeParse(rawEvent);
          if (parsed.success) sourceId = String(parsed.data.EventId);
          logger.error(
            `Meeting ${sourceId} failed without aborting run`,
            error,
          );
        }
      }),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) logger.warn(`${failed.length} meeting tasks failed`);
  logger.success(`Completed ${rawEvents.length} Durham BOCC meetings`);
}

export const durhamBocc: Scraper = {
  ...durhamBoccConfig,
  scrape: (options) =>
    scrape(
      (options?.maxItems ?? Number(process.env.DURHAM_BOCC_MAX_ITEMS)) || 100,
    ),
};

// Exported for targeted cleanup/diagnostics without widening the public API.
export async function hasDurhamMeeting(sourceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: LocalGovernmentMeeting.id })
    .from(LocalGovernmentMeeting)
    .where(
      and(
        eq(LocalGovernmentMeeting.source, PROVIDER),
        eq(LocalGovernmentMeeting.jurisdiction, JURISDICTION),
        eq(LocalGovernmentMeeting.externalId, sourceId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
