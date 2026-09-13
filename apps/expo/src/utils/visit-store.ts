/**
 * When the reader last left the app. Home uses this to decide whether a
 * record moved "while you were away" — never to invent a daily feed.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "billion.home.leftAt.v1";

export interface VisitStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function parseLeftAt(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

export function createVisitStore(storage: VisitStorage) {
  return {
    async read(): Promise<Date | undefined> {
      try {
        return parseLeftAt(await storage.getItem(STORAGE_KEY));
      } catch {
        return undefined;
      }
    },
    async markLeft(at = new Date()): Promise<void> {
      try {
        await storage.setItem(STORAGE_KEY, at.toISOString());
      } catch {
        /* a dropped timestamp is not worth interrupting home for */
      }
    },
  };
}

const store = createVisitStore(AsyncStorage);

export const readLastVisit = (): Promise<Date | undefined> => store.read();
export const markHomeLeft = (at?: Date): Promise<void> => store.markLeft(at);
