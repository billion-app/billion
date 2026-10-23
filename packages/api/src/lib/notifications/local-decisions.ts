import type { LocalDecisionFollowOccurrence } from "@acme/db/schema";
import { and, eq, exists, isNull, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LocalBody,
  LocalDecision,
  LocalIngestionRun,
  LocalJurisdiction,
  LocalMeeting,
  LocalMeetingItem,
} from "@acme/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OccurrenceSource = Pick<
  typeof LocalMeetingItem.$inferSelect,
  "id" | "actionName" | "passedFlagName" | "tally"
> &
  Pick<typeof LocalMeeting.$inferSelect, "startsAt" | "cancelled">;

export function localDecisionVisible() {
  return and(
    isNull(LocalDecision.sourceDeletedAt),
    exists(
      db
        .select({ id: LocalMeetingItem.id })
        .from(LocalMeetingItem)
        .innerJoin(
          LocalMeeting,
          eq(LocalMeeting.id, LocalMeetingItem.meetingId),
        )
        .innerJoin(LocalBody, eq(LocalBody.id, LocalMeeting.bodyId))
        .innerJoin(
          LocalJurisdiction,
          eq(LocalJurisdiction.key, LocalMeeting.jurisdictionKey),
        )
        .where(
          and(
            eq(LocalMeetingItem.decisionId, LocalDecision.id),
            eq(LocalJurisdiction.active, true),
            eq(LocalBody.included, true),
            isNull(LocalMeeting.sourceDeletedAt),
            isNull(LocalMeetingItem.sourceDeletedAt),
          ),
        ),
    ),
  );
}

export function localIngestionSettled(now: Date) {
  // The supervisor kills runs after 24 hours. Allow an hour for shutdown;
  // an abandoned running marker must not silence a city indefinitely.
  const cutoff = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  return sql<boolean>`not exists (select 1 from ${LocalIngestionRun}
    where ${LocalIngestionRun.jurisdictionKey} = ${LocalDecision.jurisdictionKey}
    and ${LocalIngestionRun.status} = 'running'
    and ${LocalIngestionRun.startedAt} > ${cutoff.toISOString()}::timestamptz)`;
}

function nonempty(value: string | null) {
  const trimmed = value?.trim();
  if (trimmed === "") return null;
  return trimmed ?? null;
}

export function projectLocalDecisionState(
  rows: OccurrenceSource[],
): LocalDecisionFollowOccurrence[] {
  return rows
    .map((row) => {
      const action = nonempty(row.actionName);
      const passed = nonempty(row.passedFlagName);
      const tally = nonempty(row.tally);
      return {
        id: row.id,
        startsAt: row.startsAt.toISOString(),
        cancelled: row.cancelled,
        outcome: action || passed || tally ? { action, passed, tally } : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function readLocalDecisionState(
  database: Transaction | typeof db,
  decisionId: string,
) {
  const rows = await database
    .select({
      id: LocalMeetingItem.id,
      startsAt: LocalMeeting.startsAt,
      cancelled: LocalMeeting.cancelled,
      actionName: LocalMeetingItem.actionName,
      passedFlagName: LocalMeetingItem.passedFlagName,
      tally: LocalMeetingItem.tally,
    })
    .from(LocalMeetingItem)
    .innerJoin(LocalMeeting, eq(LocalMeeting.id, LocalMeetingItem.meetingId))
    .innerJoin(LocalBody, eq(LocalBody.id, LocalMeeting.bodyId))
    .where(
      and(
        eq(LocalMeetingItem.decisionId, decisionId),
        eq(LocalBody.included, true),
        isNull(LocalMeetingItem.sourceDeletedAt),
        isNull(LocalMeeting.sourceDeletedAt),
      ),
    );
  return projectLocalDecisionState(rows);
}

export type LocalDecisionChange = "outcome" | "cancelled" | "schedule";

export function localDecisionChange(
  previous: LocalDecisionFollowOccurrence[] | null,
  current: LocalDecisionFollowOccurrence[],
  now: Date,
  followedAt: Date,
): LocalDecisionChange | null {
  if (!previous) return null;
  const known = new Map(previous.map((row) => [row.id, row]));
  let change: LocalDecisionChange | null = null;
  for (const row of current) {
    const before = known.get(row.id);
    if (
      row.outcome &&
      before &&
      (row.outcome.action !== before.outcome?.action ||
        row.outcome.passed !== before.outcome.passed ||
        row.outcome.tally !== before.outcome.tally)
    )
      return "outcome";
    if (row.outcome && !before && new Date(row.startsAt) >= followedAt)
      return "outcome";
    const upcoming =
      new Date(row.startsAt) >= now ||
      (before && new Date(before.startsAt) >= now);
    if (!upcoming) continue;
    if (before && !before.cancelled && row.cancelled && change !== "schedule")
      change = "cancelled";
    else if (
      !row.cancelled &&
      (before?.startsAt !== row.startsAt || before.cancelled)
    )
      change = "schedule";
  }
  return change;
}
