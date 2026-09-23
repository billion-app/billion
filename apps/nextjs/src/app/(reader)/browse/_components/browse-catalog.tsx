"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { BrowseParams, TypeFilter } from "~/lib/browse-params";
import type { ContentListItem } from "~/lib/content-card";
import type { Scope } from "~/lib/jurisdictions";
import {
  browseHref,
  PAGE_SIZE,
  parseBrowseParams,
} from "~/lib/browse-params";
import { toCardItem, withoutFeatured } from "~/lib/content-card";
import { isStateScope, JURISDICTIONS } from "~/lib/jurisdictions";
import { useStoredJurisdiction } from "~/lib/reader-state";
import { useTRPC } from "~/trpc/react";
import { FeaturedRail } from "./featured-rail";
import { FilterPills } from "./filter-pills";
import { EmptyState, ErrorState, ListSkeleton } from "./list-states";
import { ResultCard } from "./result-card";
import { ScopeBar } from "./scope-bar";
import { SearchField } from "./search-field";

/** Below this, a query is "not searching yet" — no full-text round trip per keystroke. */
const MIN_SEARCH_LENGTH = 2;

/**
 * Browse, for a browser. The phone's catalog (`apps/expo/src/app/(tabs)/index.tsx`)
 * with the same queries and the same failure copy, plus one thing the web
 * owes its readers: the view lives in the URL, so it survives a reload, a
 * shared link and the back button.
 *
 * Scope and type changes push history entries; typing replaces the current
 * one, so back leaves the search rather than un-typing it a letter at a time.
 * Both go through `history` directly, which Next keeps in step with
 * `useSearchParams`, so a filter click never waits on a server render.
 */
export function BrowseCatalog() {
  const searchParams = useSearchParams();
  const params = parseBrowseParams(searchParams);
  const { jurisdiction: stored, setJurisdiction } = useStoredJurisdiction();

  const scope: Scope = params.scope ?? "federal";
  const type = params.type;

  // A URL with no scope takes the reader's last choice, once it is known.
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current || stored === null) return;
    adopted.current = true;
    if (params.scope === null && stored !== "federal") {
      navigate({ ...params, scope: stored }, "replace");
    }
  }, [stored, params]);

  const [query, setQuery] = useState(params.q);
  const debouncedQuery = useDebounced(query, 300);

  // Keep the box in step when history moves under it (back / forward).
  const urlQuery = params.q;
  const lastWritten = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery !== lastWritten.current) {
      lastWritten.current = urlQuery;
      setQuery(urlQuery);
    }
  }, [urlQuery]);

  useEffect(() => {
    const next = debouncedQuery.trim();
    if (next === lastWritten.current) return;
    lastWritten.current = next;
    navigate({ scope, type, q: next }, "replace");
  }, [debouncedQuery, scope, type]);

  const setScope = (next: Scope) => {
    setJurisdiction(next);
    navigate({ scope: next, type, q: query.trim() }, "push");
  };
  const setType = (next: TypeFilter) =>
    navigate({ scope, type: next, q: query.trim() }, "push");

  const trpc = useTRPC();
  const searchText = debouncedQuery.trim();
  const isSearching = searchText.length >= MIN_SEARCH_LENGTH;
  const showFeatured = !isSearching && (type === "all" || type === "bill");
  const otherScope: Scope = scope === "federal" ? "ca" : "federal";

  const list = useInfiniteQuery(
    trpc.content.getByType.infiniteQueryOptions(
      { type, limit: PAGE_SIZE, jurisdiction: scope },
      { initialCursor: 0, getNextPageParam: (page) => page.nextCursor },
    ),
  );
  const featured = useQuery({
    ...trpc.content.getFeaturedBills.queryOptions({ jurisdiction: scope }),
    enabled: showFeatured,
  });
  const search = useQuery({
    ...trpc.content.search.queryOptions({
      query: searchText,
      type,
      jurisdiction: scope,
    }),
    enabled: isSearching,
  });
  const otherSearch = useQuery({
    ...trpc.content.search.queryOptions({
      query: searchText,
      type,
      jurisdiction: otherScope,
      limit: 3,
    }),
    enabled: isSearching,
  });

  const featuredItems = useMemo(
    () => (featured.data ?? []) as ContentListItem[],
    [featured.data],
  );
  const listItems = useMemo(
    () =>
      (list.data?.pages.flatMap((page) => page.items) ??
        []) as ContentListItem[],
    [list.data],
  );
  const items: ContentListItem[] = isSearching
    ? ((search.data ?? []) as ContentListItem[])
    : showFeatured
      ? withoutFeatured(listItems, featuredItems)
      : listItems;
  const loading = isSearching ? search.isLoading : list.isLoading;
  const error = isSearching ? search.error : list.error;
  const retry = () => void (isSearching ? search.refetch() : list.refetch());

  const info = JURISDICTIONS[scope];
  const isState = isStateScope(scope);
  const others = (otherSearch.data ?? []) as ContentListItem[];

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 md:grid md:grid-cols-[232px_minmax(0,1fr)] md:gap-10 md:px-8 lg:gap-14">
      {/* Desktop rail: scope and type, pinned while the results scroll. */}
      <aside className="hidden md:block">
        <div className="sticky top-[76px] flex flex-col gap-7 pt-8">
          <div>
            <RailLabel>Jurisdiction</RailLabel>
            <ScopeBar value={scope} onChange={setScope} layout="rail" />
          </div>
          <div>
            <RailLabel>Record type</RailLabel>
            <FilterPills value={type} onChange={setType} layout="rail" />
          </div>
          <p className="text-quiet border-rule border-t pt-4 font-sans text-[12px] leading-[17px]">
            Summaries are written by Billion AI from the official text. Every
            record links back to its source.
          </p>
        </div>
      </aside>

      <main className="min-w-0 pt-5 md:pt-8">
        <div className="md:hidden">
          <ScopeBar value={scope} onChange={setScope} layout="menu" />
        </div>
        <h1 className="font-display text-ink-night mt-1 text-[42px] leading-[46px] font-bold tracking-[-0.026em] md:mt-0 md:text-[52px] md:leading-[56px]">
          Browse
        </h1>
        <p className="text-quiet mt-1 mb-5 hidden font-sans text-[15px] md:block">
          {info.body} — bills
          {isState ? "" : ", executive actions and court cases"}, in plain
          language.
        </p>
        <div className="mt-[18px] mb-2 md:mt-0">
          <SearchField value={query} onChange={setQuery} />
        </div>
        <div className="pt-[10px] pb-1 md:hidden">
          <FilterPills value={type} onChange={setType} layout="scroll" />
        </div>

        {showFeatured ? (
          <div className="mt-4">
            <FeaturedRail items={featuredItems} loading={featured.isLoading} />
          </div>
        ) : null}

        <div className="mt-6 flex items-baseline justify-between">
          <p className="text-quiet font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
            {isSearching
              ? loading
                ? "Searching…"
                : `${items.length} ${items.length === 1 ? "match" : "matches"} in ${info.name}`
              : `Latest · ${info.name}`}
          </p>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState
            name={info.name}
            onRetry={retry}
            onFederal={isState ? () => setScope("federal") : undefined}
          />
        ) : items.length === 0 ? (
          <EmptyState
            scopeName={info.name}
            isState={isState}
            type={type}
            query={isSearching ? searchText : undefined}
            onShowBills={() => setType("bill")}
          />
        ) : (
          <ResultGrid>
            {items.map((item) => (
              <ResultCard key={item.id} item={toCardItem(item)} />
            ))}
          </ResultGrid>
        )}

        {!isSearching && !loading && !error && list.hasNextPage ? (
          <LoadMore
            loading={list.isFetchingNextPage}
            onLoad={() => void list.fetchNextPage()}
          />
        ) : null}

        {isSearching && others.length > 0 ? (
          <section className="border-rule mt-8 rounded-[24px] border border-dashed p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-quiet font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
                {others.length} {others.length === 1 ? "match" : "matches"} in{" "}
                {JURISDICTIONS[otherScope].name}
              </p>
              <button
                type="button"
                onClick={() => setScope(otherScope)}
                className="text-ink-night flex cursor-pointer items-center gap-[2px] font-sans text-[13px] font-semibold hover:underline"
              >
                Switch to {JURISDICTIONS[otherScope].name}
              </button>
            </div>
            <ResultGrid>
              {others.map((item) => (
                <ResultCard
                  key={item.id}
                  item={toCardItem(item, { showJurisdiction: true })}
                />
              ))}
            </ResultGrid>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function navigate(view: BrowseParams & { scope: Scope }, mode: "push" | "replace") {
  const href = browseHref(view);
  const current = window.location.pathname + window.location.search;
  if (href === current) return;
  if (mode === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
}

function ResultGrid({ children }: { children: React.ReactNode }) {
  // Rows are separated by hairlines, as on the phone; two columns from 1024px.
  return (
    <div className="divide-rule [&>*]:border-rule grid grid-cols-1 divide-y lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0 lg:[&>*]:border-b">
      {children}
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-quiet mb-2 px-3 font-sans text-[10px] font-bold tracking-[0.21em] uppercase">
      {children}
    </p>
  );
}

function LoadMore({ loading, onLoad }: { loading: boolean; onLoad: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadRef.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinel} className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        className="border-card-border text-ink-night hover:bg-slate cursor-pointer rounded-full border px-5 py-[10px] font-sans text-[13px] font-semibold disabled:opacity-60"
      >
        {loading ? "Loading…" : "Show more"}
      </button>
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
