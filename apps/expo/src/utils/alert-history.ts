/**
 * In-app notification history.
 *
 * The OS presents lock-screen / system banners. This store is the record of
 * what we sent, so Settings can show it and a tap can reopen the same route.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "billion.alert-history.v1";

export const MAX_ALERTS = 100;

export type AlertKind =
  | "follow"
  | "breaking"
  | "changes"
  | "brief"
  | "recap"
  | "court"
  | "election"
  | "test";

export interface AlertItem {
  id: string;
  /** ISO timestamp. */
  at: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Expo route this alert opens. */
  href?: string;
}

export const TEST_ALERT: Omit<AlertItem, "id" | "at"> = {
  kind: "test",
  title: "A bill you follow advanced.",
  body: "Open it for what changed.",
  href: "/changes",
};

const KINDS = new Set<AlertKind>([
  "follow",
  "breaking",
  "changes",
  "brief",
  "recap",
  "court",
  "election",
  "test",
]);

function isAlertItem(value: unknown): value is AlertItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AlertItem>;
  return (
    typeof item.id === "string" &&
    typeof item.at === "string" &&
    !Number.isNaN(Date.parse(item.at)) &&
    typeof item.kind === "string" &&
    KINDS.has(item.kind) &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    (item.href === undefined || typeof item.href === "string")
  );
}

export function parseAlertHistory(raw: string | null): AlertItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAlertItem).slice(0, MAX_ALERTS);
  } catch {
    return [];
  }
}

export function withAlert(
  items: readonly AlertItem[],
  next: AlertItem,
): AlertItem[] {
  return [next, ...items.filter((item) => item.id !== next.id)].slice(
    0,
    MAX_ALERTS,
  );
}

function atHoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

function atLocal(now: Date, hour: number, minute: number): string {
  const stamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0,
  );
  if (stamp.getTime() > now.getTime()) {
    stamp.setDate(stamp.getDate() - 1);
  }
  return stamp.toISOString();
}

/** Local stand-ins until the delivery pipeline writes real receipts. */
export function sampleAlerts(now: Date): AlertItem[] {
  return [
    {
      id: "sample-passed",
      at: atHoursAgo(now, 1.3),
      kind: "follow",
      title: "Bill you follow passed the Senate.",
      body: "Here\u2019s what changes now.",
      href: "/changes",
    },
    {
      id: "sample-election",
      at: atHoursAgo(now, 5.4),
      kind: "election",
      title: "The race you follow just reported.",
      body: "Official returns, as certified.",
      href: "/local-elections",
    },
    {
      id: "sample-brief",
      at: atLocal(now, 9, 4),
      kind: "brief",
      title: "Your Billion Brief is ready.",
      body: "5 things worth knowing today.",
      href: "/changes?lens=brief",
    },
  ];
}

export function formatAlertTime(at: Date): string {
  return at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayKey(at: Date): string {
  return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
}

export interface AlertDayGroup {
  key: string;
  label: string;
  items: AlertItem[];
}

export function groupAlertsByDay(
  items: readonly AlertItem[],
  now: Date,
): AlertDayGroup[] {
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = dayKey(yesterdayDate);

  const groups: AlertDayGroup[] = [];
  const index = new Map<string, AlertDayGroup>();

  for (const item of items) {
    const at = new Date(item.at);
    if (Number.isNaN(at.getTime())) continue;
    const key = dayKey(at);
    let group = index.get(key);
    if (!group) {
      const label =
        key === today
          ? "TODAY"
          : key === yesterday
            ? "YESTERDAY"
            : at.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              });
      group = { key, label, items: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

export interface AlertStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createAlertHistoryStore(storage: AlertStorage) {
  let loaded: Promise<AlertItem[]> | undefined;
  let updates = Promise.resolve();

  const read = (): Promise<AlertItem[]> => {
    loaded ??= storage
      .getItem(STORAGE_KEY)
      .then(parseAlertHistory)
      .catch(() => []);
    return loaded;
  };

  const commit = (
    transform: (items: AlertItem[]) => AlertItem[],
  ): Promise<AlertItem[]> => {
    let committed: AlertItem[] = [];
    const operation = updates.then(async () => {
      committed = transform(await read());
      loaded = Promise.resolve(committed);
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify(committed));
      } catch {
        /* keep the in-memory list for this session */
      }
      return committed;
    });
    updates = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  return {
    read,
    prepend(item: AlertItem) {
      return commit((items) => withAlert(items, item));
    },
    seedIfEmpty(now: Date) {
      return commit((items) => (items.length > 0 ? items : sampleAlerts(now)));
    },
  };
}

const store = createAlertHistoryStore(AsyncStorage);

export const readAlertHistory = (): Promise<AlertItem[]> => store.read();
export const prependAlert = (item: AlertItem): Promise<AlertItem[]> =>
  store.prepend(item);
export const seedAlertHistory = (now?: Date): Promise<AlertItem[]> =>
  store.seedIfEmpty(now ?? new Date());
