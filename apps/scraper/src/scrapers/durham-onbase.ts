import { createHash } from "node:crypto";

import { and, eq, notInArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  LocalGovernmentAgendaItem,
  LocalGovernmentDocument,
  LocalGovernmentMeeting,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import {
  DURHAM_ONBASE_BASE_URL,
  parseAgendaOutline,
  parseItemAttachments,
  parseMeetingIndex,
} from "./durham-onbase-parser.js";
import { durhamOnBaseConfig } from "./durham-onbase.config.js";

const PROVIDER = "onbase";
const JURISDICTION = "durham-nc";
const GOVERNING_BODY = "Durham City Council";
const SOURCE_VERSION = "onbase-agenda-online-v1";
const MIN_REQUEST_INTERVAL_MS = 250;
const logger = createLogger(durhamOnBaseConfig.name);
let nextRequestAt = 0;
let requestGate = Promise.resolve();

async function fetchOnBase(path: string): Promise<string> {
  const turn = requestGate.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  });
  requestGate = turn.catch(() => undefined);
  await turn;
  const response = await fetchWithRetry(
    new URL(path, DURHAM_ONBASE_BASE_URL).toString(),
    {
      timeoutMs: 30_000,
      headers: {
        "User-Agent":
          "Billion civic-data scraper (contact: support@billion.app)",
      },
    },
  );
  return response.text();
}

function durhamCalendarYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "America/New_York",
    }).format(date),
  );
}

function documentTypeName(documentType: 1 | 2 | 3): string {
  if (documentType === 2) return "minutes";
  if (documentType === 3) return "summary";
  return "agenda";
}

function pdfUrl(
  uniqueName: string,
  documentType: number,
  meetingId: number,
): string {
  const path = `Documents/DownloadFile/${encodeURIComponent(uniqueName)}.pdf`;
  const url = new URL(path, DURHAM_ONBASE_BASE_URL);
  url.searchParams.set("documentType", String(documentType));
  url.searchParams.set("meetingId", String(meetingId));
  return url.toString();
}

function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function scrape(maxItems = 100): Promise<void> {
  const cycleYear = new Date().getFullYear();
  const ttlHours = Number(process.env.DURHAM_ONBASE_CACHE_TTL_HOURS ?? 24);
  const cacheCutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
  logger.info(`Fetching current ${cycleYear} council cycle`);

  const indexHtml = await fetchOnBase("");
  const meetings = parseMeetingIndex(indexHtml)
    .filter((meeting) => durhamCalendarYear(meeting.date) === cycleYear)
    .slice(0, maxItems);
  setExpectedTotal(meetings.length);

  const limit = getItemLimit();
  const results = await Promise.allSettled(
    meetings.map((meeting) =>
      limit(async () => {
        const externalId = String(meeting.id);
        const [cached] = await db
          .select({ fetchedAt: LocalGovernmentMeeting.fetchedAt })
          .from(LocalGovernmentMeeting)
          .where(
            and(
              eq(LocalGovernmentMeeting.source, PROVIDER),
              eq(LocalGovernmentMeeting.jurisdiction, JURISDICTION),
              eq(LocalGovernmentMeeting.externalId, externalId),
            ),
          )
          .limit(1);
        if (cached && cached.fetchedAt >= cacheCutoff) {
          logger.info(`Cached: ${meeting.name}`);
          return;
        }

        const documentType = meeting.latestDocumentType;
        const type = documentTypeName(documentType);
        const outlineHtml = await fetchOnBase(
          `Documents/ViewAgenda?meetingId=${meeting.id}&type=${type}&doctype=${documentType}`,
        );
        const items = parseAgendaOutline(outlineHtml);

        for (const item of items) {
          const detailHtml = await fetchOnBase(
            `Meetings/ViewMeetingAgendaItem?meetingId=${meeting.id}&itemId=${item.externalId}&isSection=false&type=${type}`,
          );
          item.attachments = parseItemAttachments(detailHtml);
        }

        const sourceUrl = new URL(
          `Meetings/ViewMeeting?doctype=${documentType}&id=${meeting.id}`,
          DURHAM_ONBASE_BASE_URL,
        ).toString();
        const [storedMeeting] = await db
          .insert(LocalGovernmentMeeting)
          .values({
            source: PROVIDER,
            sourceVersion: SOURCE_VERSION,
            jurisdiction: JURISDICTION,
            governingBody: GOVERNING_BODY,
            externalId,
            title: meeting.name,
            meetingType: meeting.meetingType,
            status: documentType === 2 ? "minutes-published" : "published",
            startsAt: meeting.date,
            location: meeting.location,
            canonicalUrl: sourceUrl,
            contentHash: contentHash({ meeting, items }),
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              LocalGovernmentMeeting.source,
              LocalGovernmentMeeting.jurisdiction,
              LocalGovernmentMeeting.externalId,
            ],
            set: {
              sourceVersion: SOURCE_VERSION,
              governingBody: GOVERNING_BODY,
              title: meeting.name,
              meetingType: meeting.meetingType,
              status: documentType === 2 ? "minutes-published" : "published",
              startsAt: meeting.date,
              location: meeting.location,
              canonicalUrl: sourceUrl,
              contentHash: contentHash({ meeting, items }),
              fetchedAt: new Date(),
            },
          })
          .returning({ id: LocalGovernmentMeeting.id });
        if (!storedMeeting)
          throw new Error(`Failed to persist meeting ${externalId}`);

        const documents = [
          ...(meeting.isAgendaAvailable
            ? [
                {
                  type: "agenda",
                  title: `${meeting.name} agenda`,
                  url: pdfUrl(meeting.agendaUniqueName, 1, meeting.id),
                },
              ]
            : []),
          ...(meeting.isMinutesAvailable
            ? [
                {
                  type: "minutes",
                  title: `${meeting.name} minutes`,
                  url: pdfUrl(meeting.minutesUniqueName, 2, meeting.id),
                },
              ]
            : []),
          ...items.flatMap((item) =>
            item.attachments.map((attachment) => ({
              type: "attachment",
              title: attachment.title,
              url: attachment.url,
            })),
          ),
        ];
        for (const document of documents) {
          await db
            .insert(LocalGovernmentDocument)
            .values({
              meetingId: storedMeeting.id,
              ...document,
              mediaType: document.url.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : undefined,
              fetchedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                LocalGovernmentDocument.meetingId,
                LocalGovernmentDocument.type,
                LocalGovernmentDocument.url,
              ],
              set: {
                title: document.title,
                isCurrent: true,
                fetchedAt: new Date(),
              },
            });
        }

        for (const item of items) {
          const itemSourceUrl = new URL(
            `Meetings/ViewMeetingAgendaItem?meetingId=${meeting.id}&itemId=${item.externalId}&isSection=false&type=${type}`,
            DURHAM_ONBASE_BASE_URL,
          ).toString();
          await db
            .insert(LocalGovernmentAgendaItem)
            .values({
              meetingId: storedMeeting.id,
              externalId: item.externalId,
              sequence: item.sortOrder,
              itemNumber: item.agendaNumber,
              section: item.section,
              itemType: "agenda-item",
              title: item.title,
              motion: item.actionText,
              voteSummary: item.voteText,
              sourceUrl: itemSourceUrl,
            })
            .onConflictDoUpdate({
              target: [
                LocalGovernmentAgendaItem.meetingId,
                LocalGovernmentAgendaItem.externalId,
              ],
              set: {
                sequence: item.sortOrder,
                itemNumber: item.agendaNumber,
                section: item.section,
                title: item.title,
                motion: item.actionText,
                voteSummary: item.voteText,
                sourceUrl: itemSourceUrl,
              },
            });
        }

        if (items.length) {
          await db.delete(LocalGovernmentAgendaItem).where(
            and(
              eq(LocalGovernmentAgendaItem.meetingId, storedMeeting.id),
              notInArray(
                LocalGovernmentAgendaItem.externalId,
                items.map((item) => item.externalId),
              ),
            ),
          );
        } else {
          await db
            .delete(LocalGovernmentAgendaItem)
            .where(eq(LocalGovernmentAgendaItem.meetingId, storedMeeting.id));
        }
        logger.success(`Scraped ${meeting.name} (${items.length} items)`);
      }),
    ),
  );

  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `${failures.length} Durham meeting(s) failed`,
    );
  }
  logger.success(`Completed ${meetings.length} current-cycle meetings`);
}

export const durhamOnBase: Scraper = {
  ...durhamOnBaseConfig,
  scrape: (options) =>
    scrape(
      options?.maxItems ?? Number(process.env.DURHAM_ONBASE_MAX_ITEMS ?? 100),
    ),
};
