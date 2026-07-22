export interface RawBillAction {
  date: string;
  text: string;
  type?: string;
  actionCode?: string;
}

export interface BillTimelineAction {
  date: string;
  text: string;
  type?: string;
}

function visibleActionKey(action: RawBillAction): string {
  const date = action.date.trim();
  const text = action.text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return `${date}\u0000${text}`;
}

/**
 * Projects Congress's raw action records into user-facing timeline milestones.
 * Congress can assign multiple internal action codes to the same visible event.
 */
export function toBillTimelineActions(
  actions: readonly RawBillAction[],
): BillTimelineAction[] {
  const seen = new Set<string>();
  return actions.flatMap((action) => {
    const key = visibleActionKey(action);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ date: action.date, text: action.text, type: action.type }];
  });
}
