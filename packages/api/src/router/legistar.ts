import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@acme/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "@acme/db";
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
import {
  computeLocalDecisionSourceContext,
  validateLocalDecisionBrief,
} from "@acme/validators/local-decision";

import { JURISDICTIONS, legistar } from "../integrations/legistar";
import { publicProcedure } from "../trpc";

const jurisdictionEnum = z.enum(["sanjose", "santaclara", "sunnyvale"]);

function apiError(error: unknown, fallback: string): TRPCError {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : fallback,
    cause: error,
  });
}

const listInput = z.object({
  jurisdiction: jurisdictionEnum.default("sanjose"),
  timeline: z.enum(["upcoming", "recent", "all"]).default("upcoming"),
  from: z.date().optional(),
  to: z.date().optional(),
  topic: z.string().max(80).optional(),
  district: z.number().int().min(1).max(10).optional(),
  query: z.string().trim().min(2).max(200).optional(),
  limit: z.number().int().min(1).max(100).default(30),
  offset: z.number().int().min(0).max(10_000).default(0),
  // Alias of `offset` so tRPC's tanstack infinite-query helpers can drive
  // keyset-free paging from the client.
  cursor: z.number().int().min(0).max(10_000).optional(),
});

async function listDecisions(input: z.infer<typeof listInput>, ids?: string[]) {
  const options = input;
  const effectiveOffset = options.cursor ?? options.offset;
  const now = new Date();
  const conditions: SQL[] = [
    ...(ids
      ? [inArray(LocalDecision.id, ids)]
      : [eq(LocalMeeting.jurisdictionKey, options.jurisdiction)]),
    eq(LocalJurisdiction.active, true),
    eq(LocalBody.included, true),
    isNull(LocalMeeting.sourceDeletedAt),
    isNull(LocalMeetingItem.sourceDeletedAt),
    isNull(LocalDecision.sourceDeletedAt),
  ];
  if (options.timeline === "upcoming")
    conditions.push(gte(LocalMeeting.startsAt, options.from ?? now));
  if (options.timeline === "recent" && !ids)
    conditions.push(lte(LocalMeeting.startsAt, options.to ?? now));
  if (options.from) conditions.push(gte(LocalMeeting.startsAt, options.from));
  if (options.to) conditions.push(lte(LocalMeeting.startsAt, options.to));
  if (options.topic) conditions.push(eq(LocalDecision.topic, options.topic));
  if (options.district) {
    conditions.push(
      sql`(${LocalDecision.scopeKind} = 'citywide' or ${options.district} = any(coalesce(${LocalDecision.districtNumbers}, '{}')))`,
    );
  }
  if (options.query) {
    conditions.push(
      sql`${LocalDecision.searchVector} @@ websearch_to_tsquery('english', ${options.query})`,
    );
  }

  const representative = db
    .selectDistinctOn([LocalDecision.id], {
      id: sql<string>`${LocalDecision.id}`.as("decision_id"),
      jurisdiction: sql<string>`${LocalJurisdiction.name}`.as(
        "jurisdiction_name",
      ),
      jurisdictionKey: LocalJurisdiction.key,
      fileNumber: LocalDecision.fileNumber,
      title: LocalDecision.title,
      type: LocalDecision.typeName,
      status: LocalDecision.statusName,
      topic: LocalDecision.topic,
      scope: LocalDecision.scopeKind,
      districtNumbers: LocalDecision.districtNumbers,
      geographicText: LocalDecision.geographicText,
      sourceUrl: LocalMeeting.sourceUrl,
      meetingItemId: sql<string>`${LocalMeetingItem.id}`.as("meeting_item_id"),
      sourceEventItemId: LocalMeetingItem.sourceEventItemId,
      agendaNumber: LocalMeetingItem.agendaNumber,
      proposedAction: LocalMeetingItem.actionText,
      outcome: LocalMeetingItem.actionName,
      passed: LocalMeetingItem.passedFlagName,
      tally: LocalMeetingItem.tally,
      meetingId: sql<string>`${LocalMeeting.id}`.as("meeting_id"),
      sourceEventId: LocalMeeting.sourceEventId,
      meetingStartsAt: LocalMeeting.startsAt,
      meetingCancelled: LocalMeeting.cancelled,
      body: sql<string>`${LocalBody.name}`.as("body_name"),
      bodyRelevanceTier: LocalBody.relevanceTier,
    })
    .from(LocalMeetingItem)
    .innerJoin(LocalDecision, eq(LocalMeetingItem.decisionId, LocalDecision.id))
    .innerJoin(LocalMeeting, eq(LocalMeetingItem.meetingId, LocalMeeting.id))
    .innerJoin(LocalBody, eq(LocalMeeting.bodyId, LocalBody.id))
    .innerJoin(
      LocalJurisdiction,
      eq(LocalMeeting.jurisdictionKey, LocalJurisdiction.key),
    )
    .where(and(...conditions))
    .orderBy(
      asc(LocalDecision.id),
      options.timeline === "recent"
        ? desc(LocalMeeting.startsAt)
        : asc(LocalMeeting.startsAt),
      asc(LocalMeetingItem.id),
    )
    .as("representative");
  return db
    .select()
    .from(representative)
    .orderBy(
      ...(options.district
        ? [
            asc(
              sql`case when ${options.district} = any(coalesce(${representative.districtNumbers}, '{}')) then 0 else 1 end`,
            ),
          ]
        : []),
      options.timeline === "recent"
        ? desc(representative.meetingStartsAt)
        : asc(representative.meetingStartsAt),
      asc(representative.id),
    )
    .limit(ids ? 200 : options.limit)
    .offset(effectiveOffset);
}

export const legistarRouter = {
  /** Decision-centric, durable read API for the new frontend. */
  listDecisions: publicProcedure.input(listInput).query(async ({ input }) => {
    try {
      return await listDecisions(input);
    } catch (error) {
      throw apiError(error, "Failed to load local decisions");
    }
  }),

  byIds: publicProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).max(200) }))
    .query(({ input }) =>
      input.ids.length
        ? listDecisions(listInput.parse({ timeline: "recent" }), input.ids)
        : [],
    ),

  listJurisdictions: publicProcedure.query(() =>
    db
      .selectDistinct({
        key: LocalJurisdiction.key,
        name: LocalJurisdiction.name,
        state: LocalJurisdiction.state,
      })
      .from(LocalJurisdiction)
      .innerJoin(
        LocalDecision,
        eq(LocalDecision.jurisdictionKey, LocalJurisdiction.key),
      )
      .innerJoin(
        LocalMeetingItem,
        eq(LocalMeetingItem.decisionId, LocalDecision.id),
      )
      .innerJoin(LocalMeeting, eq(LocalMeetingItem.meetingId, LocalMeeting.id))
      .innerJoin(LocalBody, eq(LocalMeeting.bodyId, LocalBody.id))
      .where(
        and(
          eq(LocalJurisdiction.active, true),
          eq(LocalBody.included, true),
          isNull(LocalMeeting.sourceDeletedAt),
          isNull(LocalMeetingItem.sourceDeletedAt),
          inArray(LocalJurisdiction.key, ["sanjose", "santaclara"]),
          isNull(LocalDecision.sourceDeletedAt),
        ),
      )
      .orderBy(asc(LocalJurisdiction.name)),
  ),

  getDecision: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [decision] = await db
        .select({
          id: LocalDecision.id,
          jurisdictionKey: LocalDecision.jurisdictionKey,
          jurisdiction: LocalJurisdiction.name,
          fileNumber: LocalDecision.fileNumber,
          title: LocalDecision.title,
          name: LocalDecision.name,
          type: LocalDecision.typeName,
          status: LocalDecision.statusName,
          topic: LocalDecision.topic,
          scope: LocalDecision.scopeKind,
          districtNumbers: LocalDecision.districtNumbers,
          geographicText: LocalDecision.geographicText,
          introDate: LocalDecision.introDate,
          agendaDate: LocalDecision.agendaDate,
          passedDate: LocalDecision.passedDate,
          enactmentDate: LocalDecision.enactmentDate,
          enactmentNumber: LocalDecision.enactmentNumber,
          requester: LocalDecision.requester,
          notes: LocalDecision.notes,
          sourceUrl: LocalDecision.sourceUrl,
          brief: LocalDecision.brief,
          publicPortalUrl: LocalJurisdiction.publicPortalUrl,
          sourceUpdatedAt: LocalDecision.sourceUpdatedAt,
        })
        .from(LocalDecision)
        .innerJoin(
          LocalJurisdiction,
          eq(LocalDecision.jurisdictionKey, LocalJurisdiction.key),
        )
        .where(
          and(
            eq(LocalDecision.id, input.id),
            isNull(LocalDecision.sourceDeletedAt),
          ),
        )
        .limit(1);
      if (!decision) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Decision not found",
        });
      }

      const [occurrences, documents, history] = await Promise.all([
        db
          .select({
            id: LocalMeetingItem.id,
            sourceEventItemId: LocalMeetingItem.sourceEventItemId,
            agendaNumber: LocalMeetingItem.agendaNumber,
            title: LocalMeetingItem.title,
            proposedAction: LocalMeetingItem.actionText,
            action: LocalMeetingItem.actionName,
            passed: LocalMeetingItem.passedFlagName,
            tally: LocalMeetingItem.tally,
            mover: LocalMeetingItem.moverName,
            seconder: LocalMeetingItem.seconderName,
            consent: LocalMeetingItem.consent,
            minutesNote: LocalMeetingItem.minutesNote,
            meetingId: LocalMeeting.id,
            sourceEventId: LocalMeeting.sourceEventId,
            startsAt: LocalMeeting.startsAt,
            location: LocalMeeting.location,
            cancelled: LocalMeeting.cancelled,
            agendaUrl: LocalMeeting.agendaUrl,
            minutesUrl: LocalMeeting.minutesUrl,
            videoUrl: LocalMeeting.videoUrl,
            meetingSourceUrl: LocalMeeting.sourceUrl,
            body: LocalBody.name,
          })
          .from(LocalMeetingItem)
          .innerJoin(
            LocalMeeting,
            eq(LocalMeetingItem.meetingId, LocalMeeting.id),
          )
          .innerJoin(LocalBody, eq(LocalMeeting.bodyId, LocalBody.id))
          .where(
            and(
              eq(LocalMeetingItem.decisionId, input.id),
              isNull(LocalMeetingItem.sourceDeletedAt),
              isNull(LocalMeeting.sourceDeletedAt),
            ),
          )
          .orderBy(asc(LocalMeeting.startsAt)),
        db
          .select({
            id: LocalDecisionDocument.id,
            name: LocalDecisionDocument.name,
            description: LocalDecisionDocument.description,
            url: LocalDecisionDocument.url,
            category: LocalDecisionDocument.category,
            isPublicComment: LocalDecisionDocument.isPublicComment,
            extractionStatus: LocalDecisionDocument.extractionStatus,
            pageCount: LocalDecisionDocument.pageCount,
            contentHash: LocalDecisionDocument.contentHash,
            extractedPages: LocalDecisionDocument.extractedPages,
            processingPolicy: LocalDecisionDocument.processingPolicy,
            sourceDeletedAt: LocalDecisionDocument.sourceDeletedAt,
            sourceUpdatedAt: LocalDecisionDocument.sourceUpdatedAt,
          })
          .from(LocalDecisionDocument)
          .where(
            and(
              eq(LocalDecisionDocument.decisionId, input.id),
              isNull(LocalDecisionDocument.sourceDeletedAt),
            ),
          )
          .orderBy(
            asc(LocalDecisionDocument.isPublicComment),
            asc(LocalDecisionDocument.sortOrder),
          ),
        db
          .select({
            id: LocalDecisionHistory.id,
            actionDate: LocalDecisionHistory.actionDate,
            body: LocalDecisionHistory.bodyName,
            action: LocalDecisionHistory.actionName,
            description: LocalDecisionHistory.actionText,
            agendaNumber: LocalDecisionHistory.agendaNumber,
          })
          .from(LocalDecisionHistory)
          .where(eq(LocalDecisionHistory.decisionId, input.id))
          .orderBy(asc(LocalDecisionHistory.actionDate)),
      ]);

      const occurrenceIds = occurrences.map((occurrence) => occurrence.id);
      const votes = occurrenceIds.length
        ? await db
            .select({
              meetingItemId: LocalDecisionVote.meetingItemId,
              personName: LocalDecisionVote.personName,
              value: LocalDecisionVote.valueName,
              sort: LocalDecisionVote.sortOrder,
            })
            .from(LocalDecisionVote)
            .where(
              or(
                ...occurrenceIds.map((id) =>
                  eq(LocalDecisionVote.meetingItemId, id),
                ),
              ),
            )
            .orderBy(asc(LocalDecisionVote.sortOrder))
        : [];

      const publicCommentDocuments = documents.filter(
        (document) => document.isPublicComment,
      );

      return {
        ...decision,
        brief: validateLocalDecisionBrief(
          decision.brief,
          documents,
          computeLocalDecisionSourceContext({
            title: decision.title,
            status: decision.status,
            sourceUpdatedAt: decision.sourceUpdatedAt,
            occurrences,
          }),
        ),
        sourceUrl:
          occurrences.at(-1)?.meetingSourceUrl ?? decision.publicPortalUrl,
        sourceLabel: "Official meeting record",
        occurrences,
        documents: documents
          .filter((document) => !document.isPublicComment)
          .map(
            ({
              extractedPages: _pages,
              processingPolicy: _policy,
              sourceDeletedAt: _deleted,
              ...document
            }) => document,
          ),
        history,
        votes,
        publicComments: {
          documentCount: publicCommentDocuments.length,
          officialLinks: publicCommentDocuments.map((document) => ({
            id: document.id,
            url: document.url,
            label: "Public comments in the official record",
          })),
        },
        participation: {
          instructionsUrl:
            occurrences.at(-1)?.meetingSourceUrl ?? decision.publicPortalUrl,
          methods: [],
          note: "Check the official meeting agenda for participation methods and deadlines.",
        },
      };
    }),

  listBodies: publicProcedure
    .input(
      z
        .object({ jurisdiction: jurisdictionEnum.default("sanjose") })
        .optional(),
    )
    .query(({ input }) =>
      db
        .select({
          id: LocalBody.id,
          sourceBodyId: LocalBody.sourceBodyId,
          name: LocalBody.name,
          type: LocalBody.typeName,
          description: LocalBody.description,
          relevanceTier: LocalBody.relevanceTier,
        })
        .from(LocalBody)
        .where(
          and(
            eq(LocalBody.jurisdictionKey, input?.jurisdiction ?? "sanjose"),
            eq(LocalBody.included, true),
            eq(LocalBody.active, true),
          ),
        )
        .orderBy(asc(LocalBody.relevanceTier), asc(LocalBody.name)),
    ),

  getIngestionHealth: publicProcedure
    .input(
      z
        .object({ jurisdiction: jurisdictionEnum.default("sanjose") })
        .optional(),
    )
    .query(async ({ input }) => {
      const jurisdiction = input?.jurisdiction ?? "sanjose";
      const [latestRun] = await db
        .select()
        .from(LocalIngestionRun)
        .where(eq(LocalIngestionRun.jurisdictionKey, jurisdiction))
        .orderBy(desc(LocalIngestionRun.startedAt))
        .limit(1);
      const [decisionCount] = await db
        .select({ value: count() })
        .from(LocalDecision)
        .where(
          and(
            eq(LocalDecision.jurisdictionKey, jurisdiction),
            isNull(LocalDecision.sourceDeletedAt),
          ),
        );
      return {
        jurisdiction,
        latestRun: latestRun ?? null,
        activeDecisions: decisionCount?.value ?? 0,
      };
    }),

  // -----------------------------------------------------------------------
  // Deprecated wire-format compatibility endpoints. These keep the dormant
  // prototype components compiling while the new frontend moves to the
  // durable decision endpoints above. They do not write to the database.
  // -----------------------------------------------------------------------
  getLocalBills: publicProcedure.query(async () => {
    try {
      const sanjose = await legistar.getLegislation("sanjose", {});
      return sanjose.slice(0, 10).map((matter) => ({
        ...matter,
        jurisdiction: "San José" as const,
      }));
    } catch (error) {
      throw apiError(error, "Failed to fetch local bills");
    }
  }),

  getMeetings: publicProcedure
    .input(
      z
        .object({
          jurisdiction: jurisdictionEnum.optional(),
          daysAhead: z.number().min(1).max(90).default(30),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        const jurisdiction = input?.jurisdiction ?? "sanjose";
        const start = new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + (input?.daysAhead ?? 30));
        return (await legistar.getMeetings(jurisdiction, { start, end })).map(
          (meeting) => ({
            ...meeting,
            jurisdiction: JURISDICTIONS[jurisdiction].name,
          }),
        );
      } catch (error) {
        throw apiError(error, "Failed to fetch meetings");
      }
    }),

  getAgenda: publicProcedure
    .input(z.object({ jurisdiction: jurisdictionEnum, meetingId: z.number() }))
    .query(({ input }) =>
      legistar.getAgendaItems(input.jurisdiction, input.meetingId),
    ),

  getVotes: publicProcedure
    .input(
      z.object({ jurisdiction: jurisdictionEnum, eventItemId: z.number() }),
    )
    .query(({ input }) =>
      legistar.getVotes(input.jurisdiction, input.eventItemId),
    ),

  getBodies: publicProcedure
    .input(z.object({ jurisdiction: jurisdictionEnum }))
    .query(({ input }) => legistar.getBodies(input.jurisdiction)),

  getMeetingVotes: publicProcedure
    .input(z.object({ jurisdiction: jurisdictionEnum, meetingId: z.number() }))
    .query(({ input }) =>
      legistar.getMeetingVotes(input.jurisdiction, input.meetingId),
    ),
} satisfies TRPCRouterRecord;
