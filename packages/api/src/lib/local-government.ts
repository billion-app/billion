import { and, asc, desc, eq, gte, inArray, lte } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalGovernmentAgendaItem,
  LocalGovernmentDocument,
  LocalGovernmentMeeting,
  LocalGovernmentVote,
} from "@acme/db/schema";

export interface LocalGovernmentMeetingQuery {
  jurisdiction?: string;
  start?: Date;
  end?: Date;
  limit?: number;
}

export async function getLocalGovernmentMeetings(
  query: LocalGovernmentMeetingQuery = {},
) {
  const filters = [];
  if (query.jurisdiction) {
    filters.push(eq(LocalGovernmentMeeting.jurisdiction, query.jurisdiction));
  }
  if (query.start)
    filters.push(gte(LocalGovernmentMeeting.startsAt, query.start));
  if (query.end) filters.push(lte(LocalGovernmentMeeting.startsAt, query.end));

  const meetings = await db
    .select()
    .from(LocalGovernmentMeeting)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(LocalGovernmentMeeting.startsAt))
    .limit(Math.min(query.limit ?? 50, 100));
  if (meetings.length === 0) return [];

  const documents = await db
    .select({
      id: LocalGovernmentDocument.id,
      meetingId: LocalGovernmentDocument.meetingId,
      type: LocalGovernmentDocument.type,
      title: LocalGovernmentDocument.title,
      url: LocalGovernmentDocument.url,
    })
    .from(LocalGovernmentDocument)
    .where(
      inArray(
        LocalGovernmentDocument.meetingId,
        meetings.map((meeting) => meeting.id),
      ),
    )
    .orderBy(asc(LocalGovernmentDocument.type));

  return meetings.map((meeting) => ({
    ...meeting,
    documents: documents.filter((document) => document.meetingId === meeting.id),
  }));
}

export async function getLocalGovernmentMeeting(id: string) {
  const [meeting] = await db
    .select()
    .from(LocalGovernmentMeeting)
    .where(eq(LocalGovernmentMeeting.id, id))
    .limit(1);
  if (!meeting) return null;

  const [documents, items] = await Promise.all([
    db
      .select({
        id: LocalGovernmentDocument.id,
        meetingId: LocalGovernmentDocument.meetingId,
        type: LocalGovernmentDocument.type,
        title: LocalGovernmentDocument.title,
        url: LocalGovernmentDocument.url,
        mediaType: LocalGovernmentDocument.mediaType,
        checksum: LocalGovernmentDocument.checksum,
        isCurrent: LocalGovernmentDocument.isCurrent,
        discoveredAt: LocalGovernmentDocument.discoveredAt,
        fetchedAt: LocalGovernmentDocument.fetchedAt,
      })
      .from(LocalGovernmentDocument)
      .where(eq(LocalGovernmentDocument.meetingId, meeting.id))
      .orderBy(
        desc(LocalGovernmentDocument.isCurrent),
        asc(LocalGovernmentDocument.type),
      ),
    db
      .select()
      .from(LocalGovernmentAgendaItem)
      .where(eq(LocalGovernmentAgendaItem.meetingId, meeting.id))
      .orderBy(asc(LocalGovernmentAgendaItem.sequence)),
  ]);

  const votes =
    items.length === 0
      ? []
      : await db
          .select()
          .from(LocalGovernmentVote)
          .where(
            inArray(
              LocalGovernmentVote.agendaItemId,
              items.map((item) => item.id),
            ),
          )
          .orderBy(asc(LocalGovernmentVote.voterName));
  const votesByItem = new Map<string, typeof votes>();
  for (const vote of votes) {
    const list = votesByItem.get(vote.agendaItemId) ?? [];
    list.push(vote);
    votesByItem.set(vote.agendaItemId, list);
  }

  return {
    ...meeting,
    documents,
    items: items.map((item) => ({
      ...item,
      votes: votesByItem.get(item.id) ?? [],
    })),
  };
}
