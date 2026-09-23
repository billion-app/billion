import type { Metadata } from "next";
import { Suspense } from "react";

import { PAGE_SIZE, parseBrowseParams } from "~/lib/browse-params";
import { JURISDICTIONS } from "~/lib/jurisdictions";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { BrowseCatalog } from "./_components/browse-catalog";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { scope } = parseBrowseParams(await searchParams);
  const name = JURISDICTIONS[scope ?? "federal"].name;
  return {
    title: `Browse ${name} — Billion`,
    alternates: { canonical: "/browse" },
  };
}

/**
 * The first screen is rendered on the server for the scope and filter in the
 * URL, then hydrated. Everything after that — typing, filtering, paging —
 * runs on the client against the same public procedures the phone uses.
 */
export default async function BrowsePage({ searchParams }: PageProps) {
  const { scope, type, q } = parseBrowseParams(await searchParams);
  const jurisdiction = scope ?? "federal";

  prefetch(
    trpc.content.getByType.infiniteQueryOptions(
      { type, limit: PAGE_SIZE, jurisdiction },
      { initialCursor: 0, getNextPageParam: (page) => page.nextCursor },
    ),
  );
  if (!q && (type === "all" || type === "bill")) {
    prefetch(trpc.content.getFeaturedBills.queryOptions({ jurisdiction }));
  }

  return (
    <HydrateClient>
      {/* useSearchParams needs a boundary; the prefetched data streams in. */}
      <Suspense>
        <BrowseCatalog />
      </Suspense>
    </HydrateClient>
  );
}
