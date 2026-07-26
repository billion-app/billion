import { z } from "zod/v4";

import { and, eq, notInArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalGovernmentAgendaItem,
  LocalGovernmentDocument,
  LocalGovernmentMeeting,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import type {
  AdaptedStLouisItem,
  StLouisAgendaDetail,
  StLouisCalendarMeeting,
  StLouisCivicMeeting,
  StLouisDocument,
  StLouisEventDetail,
  StLouisLegislationRef,
} from "./st-louis-aldermen-parser.js";
import { getItemLimit } from "../utils/concurrency.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import {
  adaptStLouisCivicItems,
  civicMeetingDocuments,
  hash,
  legislationAgendaItems,
  parseActiveAgendaSession,
  parseActiveCalendarSession,
  parseStLouisAgendaDetail,
  parseStLouisAgendaIndex,
  parseStLouisCalendar,
  parseStLouisEventDetail,
  parseStLouisLegislationDetail,
  stLouisCivicMeetingSchema,
} from "./st-louis-aldermen-parser.js";
import { stLouisAldermenConfig } from "./st-louis-aldermen.config.js";

const CITY_BASE = "https://www.stlouis-mo.gov";
const AGENDA_INDEX = `${CITY_BASE}/government/departments/aldermen/aldermanic-legislative-session.cfm`;
const CALENDAR = `${CITY_BASE}/government/departments/aldermen/events/`;
const CIVIC_CLERK_API =
  "https://stlouismo.v8.civicclerk.com/public-api/Meetings";
const PROVIDER = "stlouis-civicclerk";
const JURISDICTION = "st-louis-mo";
const TIMEZONE = "America/Chicago";
const SOURCE_VERSION = "stlouis-aldermen-v1";
const logger = createLogger(stLouisAldermenConfig.name);

interface SourceMeeting {
  calendar: StLouisCalendarMeeting;
  detail: StLouisEventDetail;
  civic: StLouisCivicMeeting | null;
  agenda: StLouisAgendaDetail | null;
  legislation: StLouisLegislationRef[];
}

interface AdaptedMeeting {
  meeting: {
    source: string;
    sourceVersion: string;
    jurisdiction: string;
    governingBody: string;
    externalId: string;
    sessionId: string;
    agendaViewId: string | null;
    title: string;
    meetingType: string;
    status: string;
    startsAt: Date;
    timezone: string;
    location: string | null;
    isCancelled: boolean;
    isAmended: boolean;
    canonicalUrl: string;
    videoUrl: string | null;
    contentHash: string;
    sourceUpdatedAt: Date | null;
  };
  documents: StLouisDocument[];
  items: AdaptedStLouisItem[];
}

function mergeDocuments(documents: StLouisDocument[]): StLouisDocument[] {
  const merged = new Map<string, StLouisDocument>();
  for (const document of documents) {
    merged.set(`${document.type}:${document.externalId}`, document);
  }
  return [...merged.values()];
}

function mergeLegislation(
  references: StLouisLegislationRef[],
): StLouisLegislationRef[] {
  const merged = new Map<string, StLouisLegislationRef>();
  for (const reference of references) {
    const key = `${reference.kind}:${reference.externalId}`;
    const previous = merged.get(key);
    merged.set(key, {
      ...previous,
      ...reference,
      title: reference.title || previous?.title || "",
      sponsors: [
        ...new Set([...(previous?.sponsors ?? []), ...reference.sponsors]),
      ],
      documents: mergeDocuments([
        ...(previous?.documents ?? []),
        ...reference.documents,
      ]),
    });
  }
  return [...merged.values()];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "Billion civic data scraper (https://billion.app)",
    },
    timeoutMs: 30_000,
  });
  return response.text();
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Billion civic data scraper (https://billion.app)",
    },
    timeoutMs: 30_000,
  });
  return response.json() as Promise<unknown>;
}

function localDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function fetchCivicMeeting(
  calendar: StLouisCalendarMeeting,
  civicClerkId: string | null,
): Promise<StLouisCivicMeeting | null> {
  const id = civicClerkId ?? calendar.civicClerkId;
  if (!id) return null;
  const url = new URL(CIVIC_CLERK_API);
  const date = localDate(calendar.startsAt);
  url.searchParams.set("startDate", date);
  url.searchParams.set("endDate", date);
  const meetings = z
    .array(stLouisCivicMeetingSchema)
    .parse(await fetchJson(url));
  return meetings.find((meeting) => String(meeting.id) === id) ?? null;
}

async function discoverSourceMeetings(maxItems: number): Promise<{
  sessionId: string;
  sessionLabel: string;
  meetings: SourceMeeting[];
}> {
  const [agendaHtml, calendarHtml] = await Promise.all([
    fetchText(AGENDA_INDEX),
    fetchText(CALENDAR),
  ]);
  const agendaSession = parseActiveAgendaSession(agendaHtml);
  const calendarSession = parseActiveCalendarSession(calendarHtml);
  if (
    agendaSession.id !== calendarSession.id ||
    agendaSession.label !== calendarSession.label
  ) {
    throw new Error(
      `St. Louis active-session metadata disagrees: agenda=${agendaSession.id}/${agendaSession.label}, calendar=${calendarSession.id}/${calendarSession.label}`,
    );
  }

  // Both source URLs default to the selected active session. Deliberately do
  // not submit the archive selectors or construct historical session URLs.
  const calendarMeetings = parseStLouisCalendar(calendarHtml).slice(
    0,
    maxItems,
  );
  const agendaWeeks = parseStLouisAgendaIndex(agendaHtml).slice(0, maxItems);
  const limit = getItemLimit();
  const agendaDetails = await Promise.all(
    agendaWeeks.map((week) =>
      limit(async () =>
        parseStLouisAgendaDetail(await fetchText(week.detailUrl), week),
      ),
    ),
  );
  const agendasByEvent = new Map(
    agendaDetails.flatMap((agenda) =>
      agenda.eventId ? [[agenda.eventId, agenda] as const] : [],
    ),
  );

  const eventSources = await Promise.all(
    calendarMeetings.map((calendar) =>
      limit(async () => {
        const detail = parseStLouisEventDetail(
          await fetchText(calendar.canonicalUrl),
          calendar.eventId,
        );
        if (
          detail.civicClerkId &&
          calendar.civicClerkId &&
          detail.civicClerkId !== calendar.civicClerkId
        ) {
          throw new Error(
            `Event ${calendar.eventId} has conflicting CivicClerk IDs ${calendar.civicClerkId}/${detail.civicClerkId}`,
          );
        }
        const civic = await fetchCivicMeeting(calendar, detail.civicClerkId);
        return {
          calendar,
          detail,
          civic,
          agenda: agendasByEvent.get(calendar.eventId) ?? null,
        };
      }),
    ),
  );

  const references = mergeLegislation(
    eventSources.flatMap((source) => [
      ...source.detail.legislation,
      ...(source.agenda?.legislation ?? []),
    ]),
  );
  const enriched = await Promise.all(
    references.map((reference) =>
      limit(async () => {
        try {
          return parseStLouisLegislationDetail(
            await fetchText(reference.sourceUrl),
            reference,
          );
        } catch (error) {
          logger.warn(
            `Using meeting-page metadata for ${reference.kind} ${reference.number}`,
            error,
          );
          return reference;
        }
      }),
    ),
  );
  const legislationById = new Map(
    enriched.map((reference) => [
      `${reference.kind}:${reference.externalId}`,
      reference,
    ]),
  );

  return {
    sessionId: agendaSession.id,
    sessionLabel: agendaSession.label,
    meetings: eventSources.map((source) => ({
      ...source,
      legislation: mergeLegislation(
        [
          ...source.detail.legislation,
          ...(source.agenda?.legislation ?? []),
        ].map(
          (reference) =>
            legislationById.get(`${reference.kind}:${reference.externalId}`) ??
            reference,
        ),
      ),
    })),
  };
}

function adaptMeeting(
  source: SourceMeeting,
  sessionId: string,
  sessionLabel: string,
  now = new Date(),
): AdaptedMeeting {
  const civicItems = source.civic
    ? adaptStLouisCivicItems(
        source.civic,
        source.calendar.canonicalUrl,
        source.legislation,
      )
    : [];
  const linkedLegislation = new Set(
    civicItems.flatMap((item) =>
      item.legislativeId ? [item.legislativeId] : [],
    ),
  );
  const additionalItems = legislationAgendaItems(
    source.legislation.filter(
      (law) => !linkedLegislation.has(`${law.kind}:${law.externalId}`),
    ),
    civicItems.length,
  );
  const items = [...civicItems, ...additionalItems];
  const documents = mergeDocuments([
    ...(source.agenda?.documents ?? []),
    ...(source.civic ? civicMeetingDocuments(source.civic) : []),
    ...items.flatMap((item) => item.documents),
  ]);
  const sourceUpdatedAt =
    source.civic?.files.reduce<Date | null>((latest, file) => {
      const published = new Date(file.publishedOn);
      return !latest || published > latest ? published : latest;
    }, null) ?? null;
  const sourceVersion = [
    SOURCE_VERSION,
    `session:${sessionId}`,
    `event:${source.calendar.eventId}`,
    `civic:${source.civic?.id ?? source.detail.civicClerkId ?? "none"}`,
    `agenda:${source.agenda?.agendaViewId ?? "none"}`,
  ].join(":");
  const status = source.detail.isCancelled
    ? "cancelled"
    : source.calendar.startsAt < now
      ? "completed"
      : "scheduled";
  const governingBody = /committee/i.test(source.detail.meetingType)
    ? source.detail.title
    : "St. Louis Board of Aldermen";
  const mapped = {
    source: PROVIDER,
    sourceVersion,
    jurisdiction: JURISDICTION,
    governingBody,
    externalId: `event:${source.calendar.eventId}`,
    sessionId,
    agendaViewId: source.agenda?.agendaViewId ?? null,
    title: source.detail.title || source.calendar.title,
    meetingType: source.detail.meetingType,
    status,
    startsAt: source.calendar.startsAt,
    timezone: TIMEZONE,
    location: source.detail.location,
    isCancelled: source.detail.isCancelled,
    isAmended: documents.some((document) =>
      /\b(amended|revised|updated|corrected)\b/i.test(
        `${document.title} ${document.sourceVersion}`,
      ),
    ),
    canonicalUrl: source.calendar.canonicalUrl,
    videoUrl: source.detail.videoUrl,
    sourceUpdatedAt,
  };
  return {
    meeting: {
      ...mapped,
      contentHash: hash({
        ...mapped,
        sessionLabel,
        documents: documents.map((document) => ({
          id: document.externalId,
          version: document.sourceVersion,
          checksum: document.checksum,
        })),
        items: items.map((item) => item.contentHash),
      }),
    },
    documents,
    items,
  };
}

async function persistMeeting(adapted: AdaptedMeeting): Promise<void> {
  const fetchedAt = new Date();
  await db.transaction(async (tx) => {
    const [stored] = await tx
      .insert(LocalGovernmentMeeting)
      .values({ ...adapted.meeting, fetchedAt })
      .onConflictDoUpdate({
        target: [
          LocalGovernmentMeeting.source,
          LocalGovernmentMeeting.jurisdiction,
          LocalGovernmentMeeting.externalId,
        ],
        set: { ...adapted.meeting, fetchedAt },
      })
      .returning({ id: LocalGovernmentMeeting.id });
    if (!stored) {
      throw new Error(
        `Failed to persist St. Louis meeting ${adapted.meeting.externalId}`,
      );
    }

    await tx
      .update(LocalGovernmentDocument)
      .set({ isCurrent: false })
      .where(eq(LocalGovernmentDocument.meetingId, stored.id));
    for (const document of adapted.documents) {
      await tx
        .insert(LocalGovernmentDocument)
        .values({
          meetingId: stored.id,
          externalId: document.externalId,
          sourceVersion: document.sourceVersion,
          type: document.type,
          title: document.title,
          url: document.url,
          mediaType: "application/pdf",
          checksum: document.checksum,
          isCurrent: true,
          fetchedAt,
        })
        .onConflictDoUpdate({
          target: [
            LocalGovernmentDocument.meetingId,
            LocalGovernmentDocument.type,
            LocalGovernmentDocument.externalId,
          ],
          set: {
            sourceVersion: document.sourceVersion,
            title: document.title,
            url: document.url,
            mediaType: "application/pdf",
            checksum: document.checksum,
            isCurrent: true,
            fetchedAt,
          },
        });
    }

    for (const item of adapted.items) {
      const { documents: _documents, ...itemRow } = item;
      await tx
        .insert(LocalGovernmentAgendaItem)
        .values({ ...itemRow, meetingId: stored.id })
        .onConflictDoUpdate({
          target: [
            LocalGovernmentAgendaItem.meetingId,
            LocalGovernmentAgendaItem.externalId,
          ],
          set: itemRow,
        });
    }
    const externalIds = adapted.items.map((item) => item.externalId);
    await tx
      .delete(LocalGovernmentAgendaItem)
      .where(
        externalIds.length > 0
          ? and(
              eq(LocalGovernmentAgendaItem.meetingId, stored.id),
              notInArray(LocalGovernmentAgendaItem.externalId, externalIds),
            )
          : eq(LocalGovernmentAgendaItem.meetingId, stored.id),
      );
  });
}

async function scrape(maxItems: number): Promise<void> {
  logger.info(
    "Discovering selected active aldermanic session (structured HTML/JSON only; archives, AI, and OCR disabled)",
  );
  const discovery = await discoverSourceMeetings(maxItems);
  setExpectedTotal(discovery.meetings.length);
  logger.info(
    `Syncing ${discovery.meetings.length} meetings from active session ${discovery.sessionLabel} (${discovery.sessionId})`,
  );
  for (const source of discovery.meetings) {
    try {
      const adapted = adaptMeeting(
        source,
        discovery.sessionId,
        discovery.sessionLabel,
      );
      await persistMeeting(adapted);
      logger.success(
        `Synced ${adapted.meeting.title} (${adapted.meeting.externalId})`,
      );
    } catch (error) {
      logger.error(
        `Meeting event:${source.calendar.eventId} failed without aborting run`,
        error,
      );
    }
  }
}

export const stLouisAldermen: Scraper = {
  ...stLouisAldermenConfig,
  scrape: (options) =>
    scrape(
      (options?.maxItems ?? Number(process.env.ST_LOUIS_ALDERMEN_MAX_ITEMS)) ||
        100,
    ),
};
