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
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { Scope } from "./jurisdictions";
import { SCOPE_COOKIE } from "./browse-params";
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
  options: { writeCookie?: (name: string, value: string) => void } = {},
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
      // Mirrored for the server, which cannot read localStorage.
      options.writeCookie?.(SCOPE_COOKIE, next);
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
    const local = createLocalReaderState(browserStorage(), {
      writeCookie: (name, value) => {
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
      },
    });
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

// One shared snapshot of the saved list for every component on the page, read
// through `useSyncExternalStore`. A page of results has a save button per card;
// each one asks only "is *this* id saved?", so a save re-renders the one card
// that changed rather than every card and its own copy of the list.
const EMPTY: readonly string[] = [];
let savedSnapshot: readonly string[] = EMPTY;
let savedSet = new Set<string>();
let savedLoaded = false;
const savedListeners = new Set<() => void>();
let savedWired = false;

function wireSaved() {
  if (savedWired || typeof window === "undefined") return;
  savedWired = true;
  const refresh = () =>
    void readerState()
      .savedIds()
      .then((ids) => {
        savedSnapshot = ids;
        savedSet = new Set(ids);
        savedLoaded = true;
        savedListeners.forEach((listener) => listener());
      });
  refresh();
  readerState().subscribe(refresh);
}

function subscribeSaved(listener: () => void) {
  wireSaved();
  savedListeners.add(listener);
  return () => savedListeners.delete(listener);
}

/** The saved list, newest first. `ready` is false until read (and on the server). */
export function useSavedIds() {
  const ids = useSyncExternalStore(
    subscribeSaved,
    () => savedSnapshot,
    () => EMPTY,
  );
  const ready = useSyncExternalStore(
    subscribeSaved,
    () => savedLoaded,
    () => false,
  );
  return { ids, ready };
}

/** Whether one record is saved; re-renders only when that answer changes. */
export function useIsSaved(id: string) {
  return useSyncExternalStore(
    subscribeSaved,
    () => savedSet.has(id),
    () => false,
  );
}

export function toggleSaved(id: string, meta: SaveMeta) {
  const state = readerState();
  void (savedSet.has(id) ? state.unsave(id) : state.save(id, meta));
}

/**
 * Drop saved ids that no longer name a record — retired content, or an id
 * that was never valid. Without this they would stay invisible but counted:
 * the nav badge and the saved page would disagree, and dead entries would
 * take slots under `MAX_SAVED` until real saves were pushed out instead.
 */
export function forgetSaved(ids: readonly string[]) {
  const state = readerState();
  for (const id of ids) void state.unsave(id);
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
