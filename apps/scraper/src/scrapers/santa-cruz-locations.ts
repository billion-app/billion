import {
  COUNTY_LOCATIONS_ENDPOINT,
  countyLocationsCacheParams,
} from "@acme/api/lib/voting-logistics/county-locations-cache";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { collectSantaCruzLocations } from "./santa-cruz-locations-source.js";
import { santaCruzLocationsConfig } from "./santa-cruz-locations.config.js";

export const santaCruzLocations: Scraper = {
  ...santaCruzLocationsConfig,
  async scrape(options) {
    const limit =
      options?.maxItems ??
      Number(process.env.SANTA_CRUZ_LOCATIONS_MAX_ITEMS ?? 1);
    if (limit !== 1)
      throw new Error(
        "Santa Cruz location collection supports exactly one election (maxItems=1)",
      );
    const [url, date] = options?.targets ?? [
      process.env.SANTA_CRUZ_ELECTION_PAGE_URL,
      process.env.SANTA_CRUZ_ELECTION_DATE,
    ];
    if (!url || !date || (options?.targets && options.targets.length !== 2))
      throw new Error(
        "targets must contain official location URL and exact election date",
      );
    const payload = await collectSantaCruzLocations(url, date);
    const fetchedAt = new Date(payload.fetchedAt);
    const expiresAt = new Date(fetchedAt.getTime() + 24 * 60 * 60 * 1000);
    await db
      .insert(CivicApiCache)
      .values({
        addressHash: "__global__",
        endpoint: COUNTY_LOCATIONS_ENDPOINT,
        params: countyLocationsCacheParams(date, payload.jurisdiction),
        responseData: payload,
        fetchedAt,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          CivicApiCache.addressHash,
          CivicApiCache.endpoint,
          CivicApiCache.params,
        ],
        set: { responseData: payload, fetchedAt, expiresAt },
      });
  },
};
