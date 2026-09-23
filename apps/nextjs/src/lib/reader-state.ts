"use client";

/**
 * Everything personal about a web reader: what they saved and which
 * jurisdiction they browse.
 *
 * There are no accounts yet, so this first implementation keeps both in
 * `localStorage`, mirroring the phone's device-local saved list
 * (`apps/expo/src/utils/saved-store.ts`). The interface is async although
 * the storage underneath is not. When sign-in exists, a second
 * implementation can call `content.saved.*` and upload the local list once;
 * no screen has to change.
 *
 * No component may touch `localStorage` directly. Every read and write goes
 * through here, or the swap stops being a swap.
 */
import { useCallback, useEffect, useState } from "react";

import type { Scope } from "./jurisdictions";
import { isScope } from "./jurisdictions";

export interface SaveMeta {
  type: string;
  title: string;
}

export interface ReaderState {
  savedIds(): Promise<string[]>;
  save(id: string, meta: SaveMeta): Promise<void>;
  unsave(id: string): Promise<void>;
  jurisdiction(): Promise<Scope>;
  setJurisdiction(j: Scope): Promise<void>;
  /** Called after any change, from this tab or another. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Versioned so a later shape can be migrated rather than mis-parsed. */
export const SAVED_KEY = "billion.web.saved-content.v1";
export const JURISDICTION_KEY = "billion.web.jurisdiction.v1";
export const MAX_SAVED = 200;

interface SavedEntry extends SaveMeta {
  id: string;
  savedAt: number;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/* ---------- the rules ---------- */

function parseEntries(raw: string | null): SavedEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.every(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SavedEntry).id === "string",
    );
    return valid ? (parsed as SavedEntry[]) : [];
  } catch {
    return [];
  }
}

function withSaved(entries: readonly SavedEntry[], entry: SavedEntry) {
  return [entry, ...entries.filter((e) => e.id !== entry.id)].slice(
    0,
    MAX_SAVED,
  );
}

/* ---------- the storage ---------- */

export function createLocalReaderState(
  storage: KeyValueStorage | null,
): ReaderState & { reload(): void } {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const read = (key: string): string | null => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      storage?.setItem(key, value);
    } catch {
      // Keep the in-memory value: correct for this session even if the
      // browser refuses to persist it (private mode, quota, blocked site data).
    }
  };

  let entries: SavedEntry[] | undefined;
  let scope: Scope | undefined;
  const loadEntries = () => (entries ??= parseEntries(read(SAVED_KEY)));

  const commit = (next: SavedEntry[]) => {
    entries = next;
    write(SAVED_KEY, JSON.stringify(next));
    notify();
  };

  return {
    savedIds: () => Promise.resolve(loadEntries().map((entry) => entry.id)),
    save: (id, meta) => {
      commit(
        withSaved(loadEntries(), {
          id,
          type: meta.type,
          title: meta.title,
          savedAt: Date.now(),
        }),
      );
      return Promise.resolve();
    },
    unsave: (id) => {
      commit(loadEntries().filter((entry) => entry.id !== id));
      return Promise.resolve();
    },
    jurisdiction: () => {
      if (scope === undefined) {
        const stored = read(JURISDICTION_KEY);
        scope = isScope(stored) ? stored : "federal";
      }
      return Promise.resolve(scope);
    },
    setJurisdiction: (next) => {
      scope = next;
      write(JURISDICTION_KEY, next);
      notify();
      return Promise.resolve();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Drop cached values after another tab wrote, and tell subscribers. */
    reload: () => {
      entries = undefined;
      scope = undefined;
      notify();
    },
  };
}

/* ---------- the browser instance ---------- */

let instance: ReturnType<typeof createLocalReaderState> | undefined;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The reader state for this browser, kept in step with other tabs. */
export function readerState(): ReaderState {
  if (!instance) {
    const local = createLocalReaderState(browserStorage());
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === SAVED_KEY || event.key === JURISDICTION_KEY) {
          local.reload();
        }
      });
    }
    instance = local;
  }
  return instance;
}

/* ---------- hooks ---------- */

/** The saved list. `ready` is false until the first read, including on the server. */
export function useSavedIds() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      void readerState()
        .savedIds()
        .then((next) => {
          if (!live) return;
          setIds(next);
          setReady(true);
        });
    load();
    const off = readerState().subscribe(load);
    return () => {
      live = false;
      off();
    };
  }, []);

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback(
    (id: string, meta: SaveMeta) => {
      const state = readerState();
      void (ids.includes(id) ? state.unsave(id) : state.save(id, meta));
    },
    [ids],
  );

  return { ids, ready, isSaved, toggle };
}

/** The stored jurisdiction, `null` until read. */
export function useStoredJurisdiction() {
  const [jurisdiction, setLocal] = useState<Scope | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      void readerState()
        .jurisdiction()
        .then((next) => {
          if (live) setLocal(next);
        });
    load();
    const off = readerState().subscribe(load);
    return () => {
      live = false;
      off();
    };
  }, []);

  const setJurisdiction = useCallback((next: Scope) => {
    void readerState().setJurisdiction(next);
  }, []);

  return { jurisdiction, setJurisdiction };
}
