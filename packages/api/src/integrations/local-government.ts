import { and, asc, desc, eq, gte, lte } from "@acme/db";
import { db } from "@acme/db/client";
import { LocalAgendaItem, LocalMeeting } from "@acme/db/schema";

export interface LocalMeetingQuery {
  provider?: string;
  jurisdiction?: string;
  start?: Date;
  end?: Date;
  limit?: number;
}

export async function getLocalMeetings(query: LocalMeetingQuery = {}) {
  const filters = [];
  if (query.provider) filters.push(eq(LocalMeeting.provider, query.provider));
  if (query.jurisdiction)
    filters.push(eq(LocalMeeting.jurisdiction, query.jurisdiction));
  if (query.start) filters.push(gte(LocalMeeting.date, query.start));
  if (query.end) filters.push(lte(LocalMeeting.date, query.end));

  return db
    .select()
    .from(LocalMeeting)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(LocalMeeting.date))
    .limit(Math.min(query.limit ?? 50, 100));
}

export async function getLocalMeeting(
  provider: string,
  jurisdiction: string,
  externalId: string,
) {
  const [meeting] = await db
    .select()
    .from(LocalMeeting)
    .where(
      and(
        eq(LocalMeeting.provider, provider),
        eq(LocalMeeting.jurisdiction, jurisdiction),
        eq(LocalMeeting.externalId, externalId),
      ),
    )
    .limit(1);
  if (!meeting) return null;

  const agendaItems = await db
    .select()
    .from(LocalAgendaItem)
    .where(eq(LocalAgendaItem.meetingId, meeting.id))
    .orderBy(asc(LocalAgendaItem.sortOrder));
  return { ...meeting, agendaItems };
}

export type LocalMeetingRecord = Awaited<
  ReturnType<typeof getLocalMeetings>
>[number];
export type LocalMeetingDetail = NonNullable<
  Awaited<ReturnType<typeof getLocalMeeting>>
>;
