"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ContentListItem } from "~/lib/content-card";
import { toCardItem } from "~/lib/content-card";
import { forgetSaved, useSavedIds } from "~/lib/reader-state";
import { useTRPC } from "~/trpc/react";
import { ListSkeleton } from "../_components/list-states";
import { ResultCard } from "../_components/result-card";

/**
 * What this browser has saved, newest first. The list of ids is local; the
 * records come from `content.byIds`, which keeps save order and drops
 * anything retired since it was saved.
 *
 * Unsaving removes a row at once, from the local list, rather than waiting
 * for the refetch. Ids the server no longer returns are forgotten, so the
 * count here and the badge in the nav always agree.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function SavedList() {
  const { ids: stored, ready } = useSavedIds();
  // `content.byIds` rejects the whole request for one malformed id.
  const ids = useMemo(() => stored.filter((id) => UUID.test(id)), [stored]);
  const trpc = useTRPC();
  const records = useQuery({
    ...trpc.content.byIds.queryOptions({ ids }),
    enabled: ready && ids.length > 0,
    placeholderData: keepPreviousData,
  });

  // Only a real answer for exactly these ids may prune; placeholder data
  // belongs to the previous list and would drop a save made a moment ago.
  const answer =
    records.isSuccess && !records.isPlaceholderData ? records.data : null;
  useEffect(() => {
    if (!ready) return;
    const invalid = stored.filter((id) => !UUID.test(id));
    const returned = answer
      ? new Set(answer.items.map((item) => item.id))
      : null;
    const retired = returned ? ids.filter((id) => !returned.has(id)) : [];
    if (invalid.length + retired.length > 0)
      forgetSaved([...invalid, ...retired]);
  }, [ready, stored, ids, answer]);

  const saved = new Set(ids);
  const items = ((records.data?.items ?? []) as ContentListItem[]).filter(
    (item) => saved.has(item.id),
  );

  return (
    <main className="mx-auto max-w-[1240px] px-4 pt-5 pb-24 md:px-8 md:pt-10">
      <h1 className="font-display text-ink-night text-[42px] leading-[46px] font-bold tracking-[-0.026em] md:text-[52px] md:leading-[56px]">
        Saved
      </h1>
      <p className="text-quiet mt-1 mb-6 font-sans text-[14px] md:text-[15px]">
        Kept in this browser. There are no accounts yet, so saves stay on this
        device.
      </p>

      {!ready || (ids.length > 0 && records.isLoading) ? (
        <ListSkeleton />
      ) : ids.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="font-display text-ink-night text-[20px] font-bold">
            Nothing saved yet
          </p>
          <p className="text-quiet max-w-[340px] font-sans text-[14px] leading-5">
            Tap the bookmark on any record to keep it here.
          </p>
          <Link
            href="/browse"
            className="border-card-border bg-pill-on text-ink-night mt-3 rounded-full border px-[18px] py-[10px] font-sans text-[13px] font-semibold no-underline hover:brightness-125"
          >
            Browse records
          </Link>
        </div>
      ) : records.error ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="font-display text-ink-night text-[18px] font-bold">
            Saved records didn’t load
          </p>
          <p className="text-quiet font-sans text-[14px]">
            Your saves are still here. Try again.
          </p>
          <button
            type="button"
            onClick={() => void records.refetch()}
            className="border-card-border bg-pill-on text-ink-night mt-3 cursor-pointer rounded-full border px-[18px] py-[10px] font-sans text-[13px] font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="text-quiet font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
            {items.length} saved
          </p>
          <div className="[&>*]:border-rule grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10 [&>*]:border-b">
            {items.map((item) => (
              <ResultCard
                key={item.id}
                item={toCardItem(item, { showJurisdiction: true })}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
