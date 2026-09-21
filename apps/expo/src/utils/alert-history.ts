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
    return parsed
      .filter(isAlertItem)
      .filter((item) => !item.id.startsWith("sample-"))
      .slice(0, MAX_ALERTS);
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
  };
}

const store = createAlertHistoryStore(AsyncStorage);

export const readAlertHistory = (): Promise<AlertItem[]> => store.read();
export const prependAlert = (item: AlertItem): Promise<AlertItem[]> =>
  store.prepend(item);
