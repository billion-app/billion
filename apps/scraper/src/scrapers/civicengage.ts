import { createHash } from "node:crypto";
import pLimit from "p-limit";
import { getDocumentProxy } from "unpdf";

import { and, eq, notInArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalGovernmentAgendaItem,
  LocalGovernmentDocument,
  LocalGovernmentMeeting,
  LocalGovernmentVote,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import type {
  DiscoveredDocument,
  DiscoveredMeeting,
  ParsedAgendaItem,
} from "./civicengage-parser.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import {
  parseAgendaItems,
  parseMunicodePublishPage,
  SOURCE_VERSION,
} from "./civicengage-parser.js";
import {
  cedarParkCouncilConfig,
  cedarParkCouncilSource,
  municodePublishPageUrl,
} from "./civicengage.config.js";

const logger = createLogger("cedar-park-council");
const documentLimit = pLimit(2);
const USER_AGENT =
  "Billion civic data scraper (+https://github.com/billion-app/billion)";

interface FetchedDocument extends DiscoveredDocument {
  checksum?: string;
  extractedText?: string;
  fetchedAt?: Date;
}

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const proxy = await getDocumentProxy(bytes);
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= proxy.numPages; pageNumber++) {
    const page = await proxy.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .map((raw) => {
        const item = raw as { str?: string; transform?: number[] };
        return item.str && item.transform
          ? {
              text: item.str,
              x: item.transform[4] ?? 0,
              y: item.transform[5] ?? 0,
            }
          : null;
      })
      .filter(
        (item): item is { text: string; x: number; y: number } => item !== null,
      )
      .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));

    const lines: { y: number; parts: string[] }[] = [];
    for (const item of items) {
      const line = lines.find(
        (candidate) => Math.abs(candidate.y - item.y) <= 2,
      );
      if (line) line.parts.push(item.text);
      else lines.push({ y: item.y, parts: [item.text] });
    }
    pages.push(lines.map((line) => line.parts.join(" ")).join("\n"));
  }
  return pages.join("\n\n");
}

async function fetchDocument(
  document: DiscoveredDocument,
): Promise<FetchedDocument> {
  const [cached] = await db
    .select({
      checksum: LocalGovernmentDocument.checksum,
      extractedText: LocalGovernmentDocument.extractedText,
      fetchedAt: LocalGovernmentDocument.fetchedAt,
    })
    .from(LocalGovernmentDocument)
    .where(eq(LocalGovernmentDocument.url, document.url))
    .limit(1);
  if (cached?.checksum) {
    return {
      ...document,
      checksum: cached.checksum,
      extractedText: cached.extractedText ?? undefined,
      fetchedAt: cached.fetchedAt ?? undefined,
    };
  }

  try {
    const response = await fetchWithRetry(document.url, {
      headers: { Accept: document.mediaType, "User-Agent": USER_AGENT },
      timeoutMs: 60_000,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const shouldExtract =
      document.type === "agenda" || document.type === "minutes";
    return {
      ...document,
      checksum: checksum(bytes),
      extractedText: shouldExtract ? await extractPdfText(bytes) : undefined,
      fetchedAt: new Date(),
    };
  } catch (error) {
    logger.warn(`Could not fetch ${document.type} ${document.url}`, error);
    return document;
  }
}

function meetingHash(
  meeting: DiscoveredMeeting,
  documents: FetchedDocument[],
  items: ParsedAgendaItem[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: meeting.title,
        meetingType: meeting.meetingType,
        status: meeting.status,
        startsAt: meeting.startsAt.toISOString(),
        location: meeting.location,
        documents: documents.map(({ type, url, checksum, isCurrent }) => ({
          type,
          url,
          checksum,
          isCurrent,
        })),
        items,
      }),
    )
    .digest("hex");
}

async function persistMeeting(
  meeting: DiscoveredMeeting,
  documents: FetchedDocument[],
  items: ParsedAgendaItem[],
): Promise<void> {
  const fetchedAt = new Date();
  const contentHash = meetingHash(meeting, documents, items);

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(LocalGovernmentMeeting)
      .values({
        source: "civicengage",
        sourceVersion: SOURCE_VERSION,
        jurisdiction: cedarParkCouncilSource.id,
        governingBody: cedarParkCouncilSource.governingBody,
        externalId: meeting.externalId,
        title: meeting.title,
        meetingType: meeting.meetingType,
        status: meeting.status,
        startsAt: meeting.startsAt,
        location: meeting.location,
        canonicalUrl: meeting.canonicalUrl,
        contentHash,
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: [
          LocalGovernmentMeeting.source,
          LocalGovernmentMeeting.jurisdiction,
          LocalGovernmentMeeting.externalId,
        ],
        set: {
          sourceVersion: SOURCE_VERSION,
          title: meeting.title,
          meetingType: meeting.meetingType,
          status: meeting.status,
          startsAt: meeting.startsAt,
          location: meeting.location,
          canonicalUrl: meeting.canonicalUrl,
          contentHash,
          fetchedAt,
          updatedAt: fetchedAt,
        },
      })
      .returning({ id: LocalGovernmentMeeting.id });
    if (!row)
      throw new Error(`Failed to persist meeting ${meeting.externalId}`);

    await tx
      .update(LocalGovernmentDocument)
      .set({ isCurrent: false, updatedAt: fetchedAt })
      .where(eq(LocalGovernmentDocument.meetingId, row.id));

    for (const document of documents) {
      await tx
        .insert(LocalGovernmentDocument)
        .values({
          meetingId: row.id,
          type: document.type,
          title: document.title,
          url: document.url,
          mediaType: document.mediaType,
          checksum: document.checksum,
          extractedText: document.extractedText,
          isCurrent: document.isCurrent,
          fetchedAt: document.fetchedAt,
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
            extractedText: document.extractedText,
            isCurrent: document.isCurrent,
            fetchedAt: document.fetchedAt,
            updatedAt: fetchedAt,
          },
        });
    }

    for (const item of items) {
      const [itemRow] = await tx
        .insert(LocalGovernmentAgendaItem)
        .values({
          meetingId: row.id,
          externalId: item.externalId,
          sequence: item.sequence,
          itemNumber: item.itemNumber,
          section: item.section,
          itemType: item.itemType,
          title: item.title,
          description: item.description,
          consent: item.consent,
          motion: item.motion,
          outcome: item.outcome,
          voteSummary: item.voteSummary,
          sourceUrl: item.sourceUrl,
        })
        .onConflictDoUpdate({
          target: [
            LocalGovernmentAgendaItem.meetingId,
            LocalGovernmentAgendaItem.externalId,
          ],
          set: {
            sequence: item.sequence,
            itemNumber: item.itemNumber,
            section: item.section,
            itemType: item.itemType,
            title: item.title,
            description: item.description,
            consent: item.consent,
            motion: item.motion,
            outcome: item.outcome,
            voteSummary: item.voteSummary,
            sourceUrl: item.sourceUrl,
            updatedAt: fetchedAt,
          },
        })
        .returning({ id: LocalGovernmentAgendaItem.id });
      if (!itemRow) continue;
      await tx
        .delete(LocalGovernmentVote)
        .where(eq(LocalGovernmentVote.agendaItemId, itemRow.id));
      if (item.votes.length === 0) continue;
      await tx.insert(LocalGovernmentVote).values(
        item.votes.map((vote) => ({
          agendaItemId: itemRow.id,
          voterName: vote.voterName,
          value: vote.value,
        })),
      );
    }
    const staleItemFilter =
      items.length === 0
        ? eq(LocalGovernmentAgendaItem.meetingId, row.id)
        : and(
            eq(LocalGovernmentAgendaItem.meetingId, row.id),
            notInArray(
              LocalGovernmentAgendaItem.externalId,
              items.map((item) => item.externalId),
            ),
          );
    await tx.delete(LocalGovernmentAgendaItem).where(staleItemFilter);
  });
}

async function processMeeting(meeting: DiscoveredMeeting): Promise<void> {
  const documents = await Promise.all(
    meeting.documents.map((document) =>
      documentLimit(() => fetchDocument(document)),
    ),
  );
  const agenda = documents.find((document) => document.type === "agenda");
  const minutes = documents.find((document) => document.type === "minutes");
  const items = agenda?.extractedText
    ? parseAgendaItems(agenda.extractedText, minutes?.extractedText, agenda.url)
    : [];
  await persistMeeting(meeting, documents, items);
  logger.success(
    `${meeting.startsAt.toISOString().slice(0, 10)} ${meeting.title}: ${items.length} items`,
  );
}

async function scrape(maxItems = 100): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const listingUrl = municodePublishPageUrl(cedarParkCouncilSource);
  logger.info(
    `Discovering Cedar Park Council meetings since ${cutoff.toISOString()}`,
  );
  const response = await fetchWithRetry(listingUrl, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  const meetings = parseMunicodePublishPage(
    await response.text(),
    cedarParkCouncilSource,
    {
      now,
      cutoff,
    },
  ).slice(0, maxItems);
  setExpectedTotal(meetings.length);

  // Meetings are intentionally sequential; only document requests within one
  // meeting run concurrently, capped at two against the public records host.
  for (const meeting of meetings) await processMeeting(meeting);
  logger.success(`Completed ${meetings.length} Cedar Park Council meetings`);
}

export const cedarParkCouncil: Scraper = {
  ...cedarParkCouncilConfig,
  scrape: (options) =>
    scrape(
      (options?.maxItems ?? Number(process.env.CEDAR_PARK_COUNCIL_MAX_ITEMS)) ||
        100,
    ),
};
