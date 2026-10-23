import type { db } from "@acme/db/client";
import type { LocalDecisionFollowOccurrence } from "@acme/db/schema";
import { and, eq, isNull } from "@acme/db";
import { LocalMeeting, LocalMeetingItem } from "@acme/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OccurrenceSource = Pick<
  typeof LocalMeetingItem.$inferSelect,
  "id" | "actionName" | "passedFlagName" | "tally"
> &
  Pick<typeof LocalMeeting.$inferSelect, "startsAt" | "cancelled">;

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
    .where(
      and(
        eq(LocalMeetingItem.decisionId, decisionId),
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
    if (before && !before.cancelled && row.cancelled) change = "cancelled";
    else if (
      change !== "cancelled" &&
      !row.cancelled &&
      (before?.startsAt !== row.startsAt || before.cancelled)
    )
      change = "schedule";
  }
  return change;
}
