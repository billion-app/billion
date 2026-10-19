import { z } from "zod/v4";

import type { ContentJurisdiction } from "./content-jurisdiction";

const nonblank = z.string().refine((value) => value.trim().length > 0);
const timelineActionSchema = z.object({
  date: nonblank,
  text: nonblank,
  type: z.string().optional(),
});

export type BillTimelineAction = z.infer<typeof timelineActionSchema>;

function visibleActionKey(action: BillTimelineAction): string {
  const date = action.date.trim();
  const text = action.text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return `${date}\u0000${text}`;
}

/**
 * Projects Congress's raw action records into user-facing timeline milestones.
 * Congress can assign multiple internal action codes to the same visible event.
 */
export function toBillTimelineActions(
  actions: readonly unknown[],
): BillTimelineAction[] {
  const seen = new Set<string>();
  return actions.flatMap((raw) => {
    const parsed = timelineActionSchema.safeParse(raw);
    if (!parsed.success) return [];
    const action = parsed.data;
    const key = visibleActionKey(action);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ date: action.date, text: action.text, type: action.type }];
  });
}

export function billIntroductionDate({
  jurisdiction,
  introducedDate,
  actions,
}: {
  jurisdiction: ContentJurisdiction;
  introducedDate: Date | null;
  actions: readonly Pick<BillTimelineAction, "date" | "type">[] | null;
}): Date | null {
  if (jurisdiction === "federal") return introducedDate;
  // Open States used provider created_at when no introduction action existed.
  const dates = (actions ?? [])
    .filter((action) => action.type?.split(", ").includes("introduction"))
    .map((action) => new Date(action.date))
    .filter((date) => !Number.isNaN(date.getTime()));
  dates.sort((left, right) => left.getTime() - right.getTime());
  return dates[0] ?? null;
}
