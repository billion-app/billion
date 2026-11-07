import {
  CA_REGIONAL_MEASURES_ENDPOINT,
  regionalMeasuresCacheParams,
} from "@acme/api/lib/regional-measures-cache";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { collectRegionalMeasures } from "./ca-regional-measures-source.js";
import { caRegionalMeasuresConfig } from "./ca-regional-measures.config.js";

export const caRegionalMeasures: Scraper = {
  ...caRegionalMeasuresConfig,
  async scrape(options) {
    const payload = await collectRegionalMeasures(
      options?.maxItems ??
        Number(process.env.CA_REGIONAL_MEASURES_MAX_ITEMS ?? 1),
    );
    const fetchedAt = new Date(payload.fetchedAt);
    const values = {
      addressHash: "__global__",
      endpoint: CA_REGIONAL_MEASURES_ENDPOINT,
      params: regionalMeasuresCacheParams(payload.electionDate),
      responseData: payload,
      fetchedAt,
      expiresAt: new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
    await db
      .insert(CivicApiCache)
      .values(values)
      .onConflictDoUpdate({
        target: [
          CivicApiCache.addressHash,
          CivicApiCache.endpoint,
          CivicApiCache.params,
        ],
        set: { responseData: payload, fetchedAt, expiresAt: values.expiresAt },
      });
  },
};
