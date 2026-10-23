import type { LocalDecisionChange } from "./local-decisions";
import { projectBillStatus } from "../bill-status";

export const SIGNAL_CATEGORY = "billionSignal";

export type NotificationKind =
  | "executive"
  | "new_bill"
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

/** Source title only; a new order is not automatically a breaking story. */
export function executiveOrderAlertCopy(order: { id: string; title: string }) {
  return {
    kind: "executive" as const,
    title: "New executive order",
    body: clipTitle(order.title),
    href: `/article-detail?id=${order.id}`,
  };
}

export function testAlertCopy(language: "en" | "es" | "zh" = "en") {
  if (language === "zh")
    return {
      ...TEST_ALERT_COPY,
      title: "Billion 测试通知",
      body: "通知已开启。",
    };
  if (language === "es")
    return {
      ...TEST_ALERT_COPY,
      title: "Notificación de prueba de Billion",
      body: "Las notificaciones están activadas.",
    };
  return TEST_ALERT_COPY;
}

export function newBillAlertCopy(bill: {
  id: string;
  title: string;
  billNumber: string;
}) {
  return {
    kind: "new_bill" as const,
    title: "New bill in Congress",
    body: `${bill.billNumber}: ${clipTitle(bill.title)}`,
    href: `/article-detail?id=${bill.id}`,
  };
}

export function localDecisionAlertCopy(
  decision: { id: string; title: string },
  change: LocalDecisionChange,
): FollowAlertCopy {
  const bodies = {
    outcome: "An official outcome was published or updated. Open for details.",
    cancelled: "A scheduled meeting was cancelled. Open for details.",
    schedule: "The meeting schedule changed. Open for details.",
  } satisfies Record<LocalDecisionChange, string>;
  return {
    kind: "follow",
    title: clipTitle(decision.title),
    body: bodies[change],
    href: `/local-decision-detail?id=${decision.id}`,
  };
}
