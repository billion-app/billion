import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import { PUBLIC_CONTENT_STALE_TIME } from "~/utils/card-translation";
import { isLocalJurisdictionKey } from "~/utils/local-government";

export function useLocalJurisdictions() {
  const query = useQuery({
    ...trpc.legistar.listJurisdictions.queryOptions(),
    staleTime: PUBLIC_CONTENT_STALE_TIME,
  });
  return (query.data ?? [])
    .map((place) => place.key)
    .filter(isLocalJurisdictionKey);
}
