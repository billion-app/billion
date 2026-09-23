import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";

import {
  MIN_SEARCH_LENGTH,
  PAGE_SIZE,
  parseBrowseParams,
  SCOPE_COOKIE,
  scopeFromCookie,
} from "~/lib/browse-params";
import { JURISDICTIONS } from "~/lib/jurisdictions";
import { HydrateClient, prefetchNow, trpc } from "~/trpc/server";
import { BrowseCatalog } from "./_components/browse-catalog";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { scope } = parseBrowseParams(await searchParams);
  const name = JURISDICTIONS[scope ?? (await cookieScope())].name;
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
  // No scope in the URL: render the reader's stored choice, not federal and
  // then a correction after hydration.
  const defaultScope = await cookieScope();
  const jurisdiction = scope ?? defaultScope;
  const isSearching = q.length >= MIN_SEARCH_LENGTH;

  // Awaited, not streamed: what the first screen shows belongs in the HTML,
  // and the catalog's plain `useQuery` hooks must hydrate against data, not a
  // spinner. Prefetch exactly what the client will render for this URL.
  const wanted = isSearching
    ? [trpc.content.search.queryOptions({ query: q, type, jurisdiction })]
    : [
        trpc.content.getByType.infiniteQueryOptions(
          { type, limit: PAGE_SIZE, jurisdiction },
          { initialCursor: 0, getNextPageParam: (page) => page.nextCursor },
        ),
        ...(type === "all" || type === "bill"
          ? [trpc.content.getFeaturedBills.queryOptions({ jurisdiction })]
          : []),
      ];
  await Promise.all(wanted.map((options) => prefetchNow(options)));

  return (
    <HydrateClient>
      {/* useSearchParams needs a Suspense boundary to render on the server. */}
      <Suspense>
        <BrowseCatalog defaultScope={defaultScope} />
      </Suspense>
    </HydrateClient>
  );
}

/** The reader's stored jurisdiction, as mirrored into a cookie by reader-state. */
async function cookieScope() {
  return (
    scopeFromCookie((await cookies()).get(SCOPE_COOKIE)?.value) ?? "federal"
  );
}
