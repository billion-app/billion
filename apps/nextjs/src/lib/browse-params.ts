import type { Scope } from "./jurisdictions";
import { isScope } from "./jurisdictions";

/**
 * Browse keeps its view in the URL — `/browse?scope=ca&type=bill&q=wildfire`
 * — so a filtered view can be linked, shared and reached with the back
 * button. These functions are the only place that knows the parameter
 * names.
 *
 * `scope` is always written, federal included. A URL without it means "no
 * choice made", which takes the reader's stored jurisdiction; a shared
 * federal link must not be read that way and land a Texan in Texas.
 */

/** One page of Browse results; shared by the server prefetch and the client query. */
export const PAGE_SIZE = 20;

/**
 * Below this a query is "not searching yet": no full-text round trip per
 * keystroke. Shared so the server prefetches what the client will show.
 */
export const MIN_SEARCH_LENGTH = 2;

export const TYPE_FILTERS = [
  "all",
  "bill",
  "government_content",
  "court_case",
  "general",
] as const;

export type TypeFilter = (typeof TYPE_FILTERS)[number];

export const FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bill", label: "Bills" },
  { id: "government_content", label: "Executive" },
  { id: "court_case", label: "Courts" },
  { id: "general", label: "Briefings" },
];

export interface BrowseParams {
  /** `null` when the URL names no scope, so a stored choice can apply. */
  scope: Scope | null;
  type: TypeFilter;
  q: string;
}

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function isTypeFilter(value: unknown): value is TypeFilter {
  return TYPE_FILTERS.some((type) => type === value);
}

export function parseBrowseParams(params: RawParams): BrowseParams {
  const scope = first(params, "scope");
  const type = first(params, "type");
  return {
    scope: isScope(scope) ? scope : null,
    type: isTypeFilter(type) ? type : "all",
    q: (first(params, "q") ?? "").trim(),
  };
}

export function browseHref(view: {
  scope: Scope;
  type: TypeFilter;
  q: string;
}): string {
  const params = new URLSearchParams({ scope: view.scope });
  if (view.type !== "all") params.set("type", view.type);
  if (view.q.trim()) params.set("q", view.q.trim());
  return `/browse?${params.toString()}`;
}

/**
 * The stored jurisdiction, mirrored into a cookie by the reader state so the
 * server can render a bare `/browse` in the reader's own scope instead of
 * rendering federal and correcting itself after hydration.
 */
export const SCOPE_COOKIE = "billion_scope";

export function scopeFromCookie(value: string | undefined): Scope | null {
  return isScope(value) ? value : null;
}
