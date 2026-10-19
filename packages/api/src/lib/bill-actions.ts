import { z } from "zod/v4";

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
