import type { Scope } from "./jurisdictions";
import { isScope } from "./jurisdictions";

/**
 * Browse keeps its view in the URL — `/browse?scope=ca&type=bill&q=wildfire`
 * — so a filtered view can be linked, shared and reached with the back
 * button. These two functions are the only place that knows the parameter
 * names.
 */

/** One page of Browse results; shared by the server prefetch and the client query. */
export const PAGE_SIZE = 20;

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
  const params = new URLSearchParams();
  if (view.scope !== "federal") params.set("scope", view.scope);
  if (view.type !== "all") params.set("type", view.type);
  if (view.q.trim()) params.set("q", view.q.trim());
  const query = params.toString();
  return query ? `/browse?${query}` : "/browse";
}
