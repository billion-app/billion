import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";

import type {
  Jurisdiction,
  LegistarAgendaItem,
  LegistarAttachment,
  LegistarBody,
  LegistarMatter,
  LegistarMatterHistory,
  LegistarMeeting,
  LegistarVote,
} from "@acme/api/integrations/legistar";
import { JURISDICTIONS, LegistarClient } from "@acme/api/integrations/legistar";
import { and, eq, gte, inArray, isNull, lt, lte, notInArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalBody,
  LocalDecision,
  LocalDecisionDocument,
  LocalDecisionHistory,
  LocalDecisionVote,
  LocalIngestionRun,
  LocalJurisdiction,
  LocalMeeting,
  LocalMeetingItem,
} from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { incrementTotalProcessed } from "../utils/db/metrics.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import {
  bodyPolicy,
  classifyDocument,
  classifyTopic,
  inferGeographicScope,
  isDecisionItem,
} from "./legistar-policy.js";
import { legistarConfig } from "./legistar.config.js";

const logger = createLogger("Legistar");
const JURISDICTION: Jurisdiction = "sanjose";
const DEFAULT_PAST_DAYS = 45;
const DEFAULT_FUTURE_DAYS = 120;
const DEFAULT_MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MIN_NATIVE_CHARACTERS_PER_PAGE = 80;

interface IngestionCounts extends Record<string, number> {
  bodies: number;
  meetings: number;
  decisions: number;
  items: number;
  documents: number;
  documentsExtracted: number;
  documentsNeedingOcr: number;
  publicCommentsLinked: number;
  histories: number;
  votes: number;
}

interface ExtractedDocument {
  status: "native" | "ocr_required" | "skipped" | "failed";
  text: string | null;
  method: "pdf_native" | null;
  quality: number | null;
  pageCount: number | null;
  byteSize: number | null;
  mimeType: string | null;
  contentHash: string | null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function nullableDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseClock(value: string | null): { hour: number; minute: number } {
  if (!value) return { hour: 0, minute: 0 };
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)?$/i);
  if (!match) return { hour: 0, minute: 0 };
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

/** Convert a timezone-less Legistar date/time pair into an actual instant. */
export function parseLegistarMeetingStart(
  dateValue: string,
  timeValue: string | null,
  timezone: string,
): Date {
  const date = dateValue.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  const { hour, minute } = parseClock(timeValue);
  const wantedUtc = Date.UTC(year!, month! - 1, day!, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(wantedUtc))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const renderedUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  );
  return new Date(wantedUtc - (renderedUtc - wantedUtc));
}

function publicMatterUrl(matter: LegistarMatter): string {
  const portal = JURISDICTIONS[JURISDICTION].publicPortalUrl;
  return `${portal}/LegislationDetail.aspx?ID=${matter.MatterId}&GUID=${encodeURIComponent(matter.MatterGuid)}`;
}

function sourcePayload(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function isCancelled(meeting: LegistarMeeting): boolean {
  return /cancel(?:led|ed)/i.test(
    `${meeting.EventAgendaStatusName} ${meeting.EventComment ?? ""}`,
  );
}

export function nativeTextQuality(text: string, pageCount: number): number {
  if (!text.trim() || pageCount <= 0) return 0;
  const printable = [...text].filter((character) =>
    /[\p{L}\p{N}\p{P}\p{Z}\n]/u.test(character),
  ).length;
  const printableRatio = printable / text.length;
  const density = Math.min(1, text.trim().length / pageCount / 500);
  return Number((printableRatio * density).toFixed(4));
}

export function needsOcr(text: string, pageCount: number): boolean {
  return (
    text.trim().length / Math.max(pageCount, 1) < MIN_NATIVE_CHARACTERS_PER_PAGE
  );
}

async function extractPdf(
  url: string,
  maxBytes: number,
): Promise<ExtractedDocument> {
  try {
    const response = await fetchWithRetry(url, { timeoutMs: 45_000 });
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
      return {
        status: "skipped",
        text: null,
        method: null,
        quality: null,
        pageCount: null,
        byteSize: contentLength,
        mimeType: response.headers.get("content-type"),
        contentHash: null,
      };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      return {
        status: "skipped",
        text: null,
        method: null,
        quality: null,
        pageCount: null,
        byteSize: bytes.byteLength,
        mimeType: response.headers.get("content-type"),
        contentHash: null,
      };
    }
    const mimeType =
      response.headers.get("content-type")?.split(";")[0] ?? null;
    if (mimeType && mimeType !== "application/pdf") {
      return {
        status: "skipped",
        text: null,
        method: null,
        quality: null,
        pageCount: null,
        byteSize: bytes.byteLength,
        mimeType,
        contentHash: null,
      };
    }

    const document = await getDocumentProxy(bytes);
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        (content.items as { str?: string }[])
          .map((item) => item.str?.trim())
          .filter(Boolean)
          .join(" "),
      );
    }
    const text = pages.filter(Boolean).join("\n\n").trim();
    const pageCount = document.numPages;
    await document.destroy();
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    if (needsOcr(text, pageCount)) {
      return {
        status: "ocr_required",
        text: null,
        method: null,
        quality: nativeTextQuality(text, pageCount),
        pageCount,
        byteSize: bytes.byteLength,
        mimeType: mimeType ?? "application/pdf",
        contentHash,
      };
    }
    return {
      status: "native",
      text,
      method: "pdf_native",
      quality: nativeTextQuality(text, pageCount),
      pageCount,
      byteSize: bytes.byteLength,
      mimeType: mimeType ?? "application/pdf",
      contentHash,
    };
  } catch (error) {
    logger.warn(`Document extraction failed for ${url}`, error);
    return {
      status: "failed",
      text: null,
      method: null,
      quality: null,
      pageCount: null,
      byteSize: null,
      mimeType: null,
      contentHash: null,
    };
  }
}

const client = new LegistarClient((input, init) =>
  fetchWithRetry(String(input), init),
);

async function upsertJurisdiction(): Promise<void> {
  const config = JURISDICTIONS[JURISDICTION];
  await db
    .insert(LocalJurisdiction)
    .values({
      key: JURISDICTION,
      name: config.name,
      state: config.state,
      governmentLevel: "city",
      timezone: config.timezone,
      sourceType: "legistar",
      sourceClient: config.client,
      sourceBaseUrl: config.baseUrl,
      publicPortalUrl: config.publicPortalUrl,
    })
    .onConflictDoUpdate({
      target: LocalJurisdiction.key,
      set: {
        name: config.name,
        state: config.state,
        timezone: config.timezone,
        sourceBaseUrl: config.baseUrl,
        publicPortalUrl: config.publicPortalUrl,
        active: true,
      },
    });
}

async function upsertBody(body: LegistarBody, seenAt: Date): Promise<string> {
  const policy = bodyPolicy(body.BodyId);
  const [row] = await db
    .insert(LocalBody)
    .values({
      jurisdictionKey: JURISDICTION,
      sourceBodyId: body.BodyId,
      sourceGuid: body.BodyGuid,
      name: body.BodyName,
      typeName: body.BodyTypeName,
      active: body.BodyActiveFlag === 1,
      included: policy.included,
      relevanceTier: policy.relevanceTier,
      numberOfMembers: body.BodyNumberOfMembers,
      description: body.BodyDescription,
      contactName: body.BodyContactFullName,
      contactEmail: body.BodyContactEmail,
      contactPhone: body.BodyContactPhone,
      sourceUpdatedAt: nullableDate(body.BodyLastModifiedUtc),
      lastSeenAt: seenAt,
      sourcePayload: sourcePayload(body),
    })
    .onConflictDoUpdate({
      target: [LocalBody.jurisdictionKey, LocalBody.sourceBodyId],
      set: {
        sourceGuid: body.BodyGuid,
        name: body.BodyName,
        typeName: body.BodyTypeName,
        active: body.BodyActiveFlag === 1,
        included: policy.included,
        relevanceTier: policy.relevanceTier,
        numberOfMembers: body.BodyNumberOfMembers,
        description: body.BodyDescription,
        contactName: body.BodyContactFullName,
        contactEmail: body.BodyContactEmail,
        contactPhone: body.BodyContactPhone,
        sourceUpdatedAt: nullableDate(body.BodyLastModifiedUtc),
        lastSeenAt: seenAt,
        sourcePayload: sourcePayload(body),
      },
    })
    .returning({ id: LocalBody.id });
  return row!.id;
}

async function upsertMeeting(
  meeting: LegistarMeeting,
  bodyId: string,
  seenAt: Date,
): Promise<string> {
  const timezone = JURISDICTIONS[JURISDICTION].timezone;
  const [row] = await db
    .insert(LocalMeeting)
    .values({
      jurisdictionKey: JURISDICTION,
      bodyId,
      sourceEventId: meeting.EventId,
      sourceGuid: meeting.EventGuid,
      startsAt: parseLegistarMeetingStart(
        meeting.EventDate,
        meeting.EventTime,
        timezone,
      ),
      localDate: meeting.EventDate.slice(0, 10),
      timeLabel: meeting.EventTime,
      location: meeting.EventLocation,
      agendaUrl: meeting.EventAgendaFile,
      minutesUrl: meeting.EventMinutesFile,
      videoUrl: meeting.EventVideoPath,
      sourceUrl: meeting.EventInSiteURL,
      agendaStatusName: meeting.EventAgendaStatusName,
      minutesStatusName: meeting.EventMinutesStatusName,
      comment: meeting.EventComment,
      cancelled: isCancelled(meeting),
      sourceUpdatedAt: nullableDate(meeting.EventLastModifiedUtc) ?? seenAt,
      lastSeenAt: seenAt,
      sourceDeletedAt: null,
      sourcePayload: sourcePayload(meeting),
    })
    .onConflictDoUpdate({
      target: [LocalMeeting.jurisdictionKey, LocalMeeting.sourceEventId],
      set: {
        bodyId,
        sourceGuid: meeting.EventGuid,
        startsAt: parseLegistarMeetingStart(
          meeting.EventDate,
          meeting.EventTime,
          timezone,
        ),
        localDate: meeting.EventDate.slice(0, 10),
        timeLabel: meeting.EventTime,
        location: meeting.EventLocation,
        agendaUrl: meeting.EventAgendaFile,
        minutesUrl: meeting.EventMinutesFile,
        videoUrl: meeting.EventVideoPath,
        sourceUrl: meeting.EventInSiteURL,
        agendaStatusName: meeting.EventAgendaStatusName,
        minutesStatusName: meeting.EventMinutesStatusName,
        comment: meeting.EventComment,
        cancelled: isCancelled(meeting),
        sourceUpdatedAt: nullableDate(meeting.EventLastModifiedUtc) ?? seenAt,
        lastSeenAt: seenAt,
        sourceDeletedAt: null,
        sourcePayload: sourcePayload(meeting),
      },
    })
    .returning({ id: LocalMeeting.id });
  return row!.id;
}

async function upsertDecision(
  matter: LegistarMatter,
  item: LegistarAgendaItem,
  bodyId: string | null,
  seenAt: Date,
): Promise<string> {
  const scope = inferGeographicScope(matter, item);
  const values = {
    primaryBodyId: bodyId,
    sourceGuid: matter.MatterGuid,
    fileNumber: matter.MatterFile || null,
    title: matter.MatterTitle || item.EventItemTitle || "Untitled decision",
    name: matter.MatterName,
    typeName: matter.MatterTypeName,
    statusName: matter.MatterStatusName,
    topic: classifyTopic(matter),
    scopeKind: scope.kind,
    districtNumbers: scope.districtNumbers,
    geographicText: scope.text,
    introDate: nullableDate(matter.MatterIntroDate),
    agendaDate: nullableDate(matter.MatterAgendaDate),
    passedDate: nullableDate(matter.MatterPassedDate),
    enactmentDate: nullableDate(matter.MatterEnactmentDate),
    enactmentNumber: matter.MatterEnactmentNumber,
    requester: matter.MatterRequester,
    notes: matter.MatterNotes,
    sourceUrl: publicMatterUrl(matter),
    sourceUpdatedAt: nullableDate(matter.MatterLastModifiedUtc) ?? seenAt,
    lastSeenAt: seenAt,
    sourceDeletedAt: null,
    sourcePayload: sourcePayload(matter),
  };
  const [row] = await db
    .insert(LocalDecision)
    .values({
      jurisdictionKey: JURISDICTION,
      sourceMatterId: matter.MatterId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [LocalDecision.jurisdictionKey, LocalDecision.sourceMatterId],
      set: values,
    })
    .returning({ id: LocalDecision.id });
  return row!.id;
}

async function upsertMeetingItem(
  item: LegistarAgendaItem,
  meetingId: string,
  decisionId: string | null,
  seenAt: Date,
): Promise<string> {
  const values = {
    decisionId,
    sourceGuid: item.EventItemGuid,
    agendaSequence: item.EventItemAgendaSequence,
    minutesSequence: item.EventItemMinutesSequence,
    agendaNumber: item.EventItemAgendaNumber,
    title: item.EventItemTitle,
    actionName: item.EventItemActionName,
    actionText: item.EventItemActionText,
    passedFlagName: item.EventItemPassedFlagName,
    tally: item.EventItemTally,
    moverName: item.EventItemMover,
    seconderName: item.EventItemSeconder,
    consent: item.EventItemConsent === 1,
    rollCall: item.EventItemRollCallFlag === 1,
    agendaNote: item.EventItemAgendaNote,
    minutesNote: item.EventItemMinutesNote,
    videoIndex: item.EventItemVideoIndex,
    sourceUpdatedAt: nullableDate(item.EventItemLastModifiedUtc) ?? seenAt,
    lastSeenAt: seenAt,
    sourceDeletedAt: null,
    sourcePayload: sourcePayload(item),
  };
  const [row] = await db
    .insert(LocalMeetingItem)
    .values({
      meetingId,
      sourceEventItemId: item.EventItemId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [LocalMeetingItem.meetingId, LocalMeetingItem.sourceEventItemId],
      set: values,
    })
    .returning({ id: LocalMeetingItem.id });
  return row!.id;
}

async function documentExtraction(
  attachment: LegistarAttachment,
  processingPolicy: "extract_text" | "link_only",
  maxBytes: number,
  skipText: boolean,
): Promise<ExtractedDocument> {
  if (processingPolicy === "link_only" || skipText) {
    return {
      status: "skipped",
      text: null,
      method: null,
      quality: null,
      pageCount: null,
      byteSize: null,
      mimeType: null,
      contentHash: null,
    };
  }

  const [existing] = await db
    .select({
      sourceUpdatedAt: LocalDecisionDocument.sourceUpdatedAt,
      extractionStatus: LocalDecisionDocument.extractionStatus,
      extractedText: LocalDecisionDocument.extractedText,
      extractionMethod: LocalDecisionDocument.extractionMethod,
      extractionQuality: LocalDecisionDocument.extractionQuality,
      pageCount: LocalDecisionDocument.pageCount,
      byteSize: LocalDecisionDocument.byteSize,
      mimeType: LocalDecisionDocument.mimeType,
      contentHash: LocalDecisionDocument.contentHash,
    })
    .from(LocalDecisionDocument)
    .where(
      and(
        eq(LocalDecisionDocument.jurisdictionKey, JURISDICTION),
        eq(
          LocalDecisionDocument.sourceAttachmentId,
          attachment.MatterAttachmentId,
        ),
      ),
    )
    .limit(1);
  const sourceUpdatedAt = nullableDate(
    attachment.MatterAttachmentLastModifiedUtc,
  );
  if (
    existing &&
    existing.sourceUpdatedAt?.getTime() === sourceUpdatedAt?.getTime() &&
    (["native", "ocr_required"].includes(existing.extractionStatus) ||
      (existing.extractionStatus === "skipped" &&
        ((existing.byteSize !== null && existing.byteSize > maxBytes) ||
          (existing.mimeType !== null &&
            existing.mimeType !== "application/pdf"))))
  ) {
    return {
      status: existing.extractionStatus as ExtractedDocument["status"],
      text: existing.extractedText,
      method: existing.extractionMethod === "pdf_native" ? "pdf_native" : null,
      quality: existing.extractionQuality,
      pageCount: existing.pageCount,
      byteSize: existing.byteSize,
      mimeType: existing.mimeType,
      contentHash: existing.contentHash,
    };
  }
  return extractPdf(attachment.MatterAttachmentHyperlink, maxBytes);
}

async function upsertDocument(
  attachment: LegistarAttachment,
  decisionId: string,
  seenAt: Date,
  counts: IngestionCounts,
  maxBytes: number,
  skipText: boolean,
): Promise<void> {
  const policy = classifyDocument(attachment);
  const extraction = await documentExtraction(
    attachment,
    policy.processingPolicy,
    maxBytes,
    skipText,
  );
  await db
    .insert(LocalDecisionDocument)
    .values({
      jurisdictionKey: JURISDICTION,
      decisionId,
      sourceAttachmentId: attachment.MatterAttachmentId,
      sourceGuid: attachment.MatterAttachmentGuid,
      name: attachment.MatterAttachmentName,
      description: attachment.MatterAttachmentDescription,
      url: attachment.MatterAttachmentHyperlink,
      fileName: attachment.MatterAttachmentFileName,
      category: policy.category,
      sortOrder: attachment.MatterAttachmentSort,
      isSupportingDocument: attachment.MatterAttachmentIsSupportingDocument,
      isPublicComment: policy.isPublicComment,
      processingPolicy: policy.processingPolicy,
      extractionStatus: extraction.status,
      extractedText: extraction.text,
      extractionMethod: extraction.method,
      extractionQuality: extraction.quality,
      pageCount: extraction.pageCount,
      byteSize: extraction.byteSize,
      mimeType: extraction.mimeType,
      contentHash: extraction.contentHash,
      sourceUpdatedAt: nullableDate(attachment.MatterAttachmentLastModifiedUtc),
      lastSeenAt: seenAt,
      sourceDeletedAt: null,
      sourcePayload: sourcePayload(attachment),
    })
    .onConflictDoUpdate({
      target: [
        LocalDecisionDocument.jurisdictionKey,
        LocalDecisionDocument.sourceAttachmentId,
      ],
      set: {
        decisionId,
        name: attachment.MatterAttachmentName,
        description: attachment.MatterAttachmentDescription,
        url: attachment.MatterAttachmentHyperlink,
        fileName: attachment.MatterAttachmentFileName,
        category: policy.category,
        sortOrder: attachment.MatterAttachmentSort,
        isSupportingDocument: attachment.MatterAttachmentIsSupportingDocument,
        isPublicComment: policy.isPublicComment,
        processingPolicy: policy.processingPolicy,
        extractionStatus: extraction.status,
        extractedText: extraction.text,
        extractionMethod: extraction.method,
        extractionQuality: extraction.quality,
        pageCount: extraction.pageCount,
        byteSize: extraction.byteSize,
        mimeType: extraction.mimeType,
        contentHash: extraction.contentHash,
        sourceUpdatedAt: nullableDate(
          attachment.MatterAttachmentLastModifiedUtc,
        ),
        lastSeenAt: seenAt,
        sourceDeletedAt: null,
        sourcePayload: sourcePayload(attachment),
      },
    });
  counts.documents++;
  if (policy.isPublicComment) counts.publicCommentsLinked++;
  if (extraction.status === "native") counts.documentsExtracted++;
  if (extraction.status === "ocr_required") counts.documentsNeedingOcr++;
}

async function upsertHistory(
  history: LegistarMatterHistory,
  decisionId: string,
): Promise<void> {
  const values = {
    sourceEventId: history.MatterHistoryEventId,
    sourceEventItemId: history.MatterHistoryEventItemId,
    bodyName: history.MatterHistoryBodyName,
    actionName: history.MatterHistoryActionName,
    actionText: history.MatterHistoryDescription,
    actionDate: nullableDate(history.MatterHistoryActionDate),
    agendaNumber: history.MatterHistoryAgendaNumber,
    sourcePayload: sourcePayload(history),
  };
  await db
    .insert(LocalDecisionHistory)
    .values({
      decisionId,
      sourceHistoryId: history.MatterHistoryId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [
        LocalDecisionHistory.decisionId,
        LocalDecisionHistory.sourceHistoryId,
      ],
      set: values,
    });
}

async function upsertVote(
  vote: LegistarVote,
  meetingItemId: string,
  seenAt: Date,
): Promise<void> {
  const values = {
    sourcePersonId: vote.VotePersonId,
    personName: vote.VotePersonName,
    valueName: vote.VoteValueName,
    sortOrder: vote.VoteSort,
    sourceUpdatedAt: nullableDate(vote.VoteLastModifiedUtc) ?? seenAt,
    sourcePayload: sourcePayload(vote),
  };
  await db
    .insert(LocalDecisionVote)
    .values({ meetingItemId, sourceVoteId: vote.VoteId, ...values })
    .onConflictDoUpdate({
      target: [LocalDecisionVote.meetingItemId, LocalDecisionVote.sourceVoteId],
      set: values,
    });
}

async function processMeeting(
  meeting: LegistarMeeting,
  bodyIds: ReadonlyMap<number, string>,
  seenAt: Date,
  counts: IngestionCounts,
  maxBytes: number,
  skipText: boolean,
  seenAttachments: Map<string, Set<number>>,
): Promise<void> {
  const bodyId = bodyIds.get(meeting.EventBodyId);
  if (!bodyId) return;
  const meetingId = await upsertMeeting(meeting, bodyId, seenAt);
  counts.meetings++;

  const items = await client.getAgendaItems(JURISDICTION, meeting.EventId);
  const decisionItems = items.filter(isDecisionItem);
  for (const item of decisionItems) {
    const matter = await client.getMatter(
      JURISDICTION,
      item.EventItemMatterId!,
    );
    const matterBodyId = bodyIds.get(matter.MatterBodyId) ?? bodyId;
    const decisionId = await upsertDecision(matter, item, matterBodyId, seenAt);
    const meetingItemId = await upsertMeetingItem(
      item,
      meetingId,
      decisionId,
      seenAt,
    );
    counts.decisions++;
    counts.items++;
    incrementTotalProcessed();

    const attachments = item.EventItemMatterAttachments ?? [];
    const attachmentIds = seenAttachments.get(decisionId) ?? new Set<number>();
    seenAttachments.set(decisionId, attachmentIds);
    for (const attachment of attachments) {
      attachmentIds.add(attachment.MatterAttachmentId);
      await upsertDocument(
        attachment,
        decisionId,
        seenAt,
        counts,
        maxBytes,
        skipText,
      );
    }

    // San José currently returns empty histories for sampled matters, but keep
    // the capability live for jurisdictions/records that publish them. Limit
    // the extra call to non-agenda-ready records where history is most useful.
    if (!/agenda ready/i.test(matter.MatterStatusName)) {
      const histories = await client.getMatterHistories(
        JURISDICTION,
        matter.MatterId,
      );
      for (const history of histories) {
        await upsertHistory(history, decisionId);
        counts.histories++;
      }
    }

    if (
      item.EventItemRollCallFlag === 1 ||
      item.EventItemTally ||
      item.EventItemActionName
    ) {
      const votes = await client.getVotes(JURISDICTION, item.EventItemId);
      for (const vote of votes) {
        await upsertVote(vote, meetingItemId, seenAt);
        counts.votes++;
      }
    }
  }

  await db
    .update(LocalMeetingItem)
    .set({ sourceDeletedAt: seenAt })
    .where(
      and(
        eq(LocalMeetingItem.meetingId, meetingId),
        lt(LocalMeetingItem.lastSeenAt, seenAt),
      ),
    );
}

async function runLegistarScrape(maxItems?: number): Promise<void> {
  const seenAt = new Date();
  const pastDays = positiveInteger(
    process.env.LEGISTAR_PAST_DAYS,
    DEFAULT_PAST_DAYS,
  );
  const futureDays = positiveInteger(
    process.env.LEGISTAR_FUTURE_DAYS,
    DEFAULT_FUTURE_DAYS,
  );
  const maxBytes = positiveInteger(
    process.env.LEGISTAR_MAX_DOCUMENT_BYTES,
    DEFAULT_MAX_DOCUMENT_BYTES,
  );
  const skipText = process.env.LEGISTAR_SKIP_DOCUMENT_TEXT === "1";
  const windowStart = addDays(seenAt, -pastDays);
  const windowEnd = addDays(seenAt, futureDays);
  const counts: IngestionCounts = {
    bodies: 0,
    meetings: 0,
    decisions: 0,
    items: 0,
    documents: 0,
    documentsExtracted: 0,
    documentsNeedingOcr: 0,
    publicCommentsLinked: 0,
    histories: 0,
    votes: 0,
  };

  await upsertJurisdiction();
  const [run] = await db
    .insert(LocalIngestionRun)
    .values({
      jurisdictionKey: JURISDICTION,
      status: "running",
      windowStart,
      windowEnd,
      counts,
    })
    .returning({ id: LocalIngestionRun.id });

  try {
    const bodies = await client.getBodies(JURISDICTION);
    const bodyIds = new Map<number, string>();
    for (const body of bodies) {
      const id = await upsertBody(body, seenAt);
      if (bodyPolicy(body.BodyId).included) bodyIds.set(body.BodyId, id);
      counts.bodies++;
    }

    const fetchedMeetings = await client.getMeetings(JURISDICTION, {
      start: windowStart,
      end: windowEnd,
    });
    const relevantMeetings = fetchedMeetings.filter((meeting) =>
      bodyIds.has(meeting.EventBodyId),
    );
    const meetings = relevantMeetings.slice(0, maxItems);
    const seenAttachments = new Map<string, Set<number>>();
    const limit = getItemLimit();
    await Promise.all(
      meetings.map((meeting) =>
        limit(() =>
          processMeeting(
            meeting,
            bodyIds,
            seenAt,
            counts,
            maxBytes,
            skipText,
            seenAttachments,
          ),
        ),
      ),
    );

    // Attachments are returned as a complete snapshot on every processed
    // matter occurrence. Keep removed source files for auditability, but hide
    // them from normal reads by recording when they disappeared.
    for (const [decisionId, attachmentIds] of seenAttachments) {
      const predicates = [
        eq(LocalDecisionDocument.decisionId, decisionId),
        eq(LocalDecisionDocument.jurisdictionKey, JURISDICTION),
        isNull(LocalDecisionDocument.sourceDeletedAt),
      ];
      if (attachmentIds.size > 0) {
        predicates.push(
          notInArray(LocalDecisionDocument.sourceAttachmentId, [
            ...attachmentIds,
          ]),
        );
      }
      await db
        .update(LocalDecisionDocument)
        .set({ sourceDeletedAt: seenAt })
        .where(and(...predicates));
    }

    // Only a complete window walk can prove a meeting disappeared. Targeted
    // --max-items runs intentionally skip tombstoning.
    if (maxItems === undefined || relevantMeetings.length <= maxItems) {
      await db
        .update(LocalMeeting)
        .set({ sourceDeletedAt: seenAt })
        .where(
          and(
            eq(LocalMeeting.jurisdictionKey, JURISDICTION),
            inArray(LocalMeeting.bodyId, [...bodyIds.values()]),
            gte(LocalMeeting.startsAt, windowStart),
            lte(LocalMeeting.startsAt, windowEnd),
            lt(LocalMeeting.lastSeenAt, seenAt),
          ),
        );
    }

    await db
      .update(LocalIngestionRun)
      .set({ status: "succeeded", completedAt: new Date(), counts })
      .where(eq(LocalIngestionRun.id, run!.id));
    logger.success(
      `Stored ${counts.decisions} decision occurrences across ${counts.meetings} meetings`,
    );
  } catch (error) {
    await db
      .update(LocalIngestionRun)
      .set({
        status: "failed",
        completedAt: new Date(),
        counts,
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(LocalIngestionRun.id, run!.id));
    throw error;
  }
}

export const legistarScraper: Scraper = {
  ...legistarConfig,
  scrape: async ({ maxItems } = {}) =>
    runLegistarScrape(
      maxItems ?? positiveInteger(process.env.LEGISTAR_MAX_ITEMS, 100),
    ),
};
