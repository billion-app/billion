import { projectBillStatus } from "../bill-status";

export const SIGNAL_CATEGORY = "billionSignal";

export type NotificationKind =
  | "follow"
  | "breaking"
  | "brief"
  | "recap"
  | "test";

export interface FollowAlertCopy {
  kind: "follow";
  title: string;
  body: string;
  href: string;
}

function clipTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77).trimEnd()}…`;
}

/** Event line for a bill the reader asked us to watch. */
export function followAlertCopy(bill: {
  id: string;
  title: string;
  billNumber: string;
  status?: string | null;
  actions?:
    | { date: string; text: string; type?: string; actionCode?: string }[]
    | null;
}): FollowAlertCopy {
  const status = projectBillStatus({
    billNumber: bill.billNumber,
    status: bill.status,
    actions: bill.actions,
  });
  return {
    kind: "follow",
    title: clipTitle(bill.title),
    body: `${bill.billNumber} — ${status}.`,
    href: `/article-detail?id=${bill.id}`,
  };
}

export const TEST_ALERT_COPY = {
  kind: "test" as const,
  title: "A bill you follow advanced.",
  body: "Open it for what changed.",
  href: "/settings/notifications",
};
