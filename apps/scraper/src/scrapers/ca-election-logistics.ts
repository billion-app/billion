import { load } from "cheerio";

import {
  CA_LOGISTICS_ENDPOINT,
  caLogisticsCacheParams,
} from "@acme/api/lib/voting-logistics/ca-sos-cache";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import {
  electionDateFromUrl,
  parseCaElectionLogistics,
} from "./ca-election-logistics-parser.js";
import { fetchCaElectionPage as fetchPage } from "./ca-election-logistics-source.js";
import { caElectionLogisticsConfig } from "./ca-election-logistics.config.js";

const INDEX = "https://www.sos.ca.gov/elections/upcoming-elections";
export const caElectionLogistics: Scraper = {
  ...caElectionLogisticsConfig,
  async scrape(options) {
    const now = new Date();
    const limit =
      options?.maxItems ?? Number(process.env.CA_LOGISTICS_MAX_ITEMS ?? 1);
    if (!Number.isInteger(limit) || limit < 1 || limit > 4)
      throw new Error("maxItems must be 1–4");
    const $ = load(await fetchPage(INDEX));
    const urls = new Set<string>();
    $("a[href]").each((_, el) => {
      const raw = new URL($(el).attr("href")!, INDEX);
      const url = `${raw.origin}${raw.pathname.replace(/\/$/, "")}/key-dates-deadlines`;
      try {
        const date = electionDateFromUrl(url);
        if (date >= now.toISOString().slice(0, 10)) urls.add(url);
      } catch {
        /* Ignore links that are not election pages. */
      }
    });
    if (!urls.size)
      throw new Error("No upcoming election-specific CA pages discovered");
    for (const url of [...urls]
      .sort((a, b) =>
        electionDateFromUrl(a).localeCompare(electionDateFromUrl(b)),
      )
      .slice(0, limit)) {
      const payload = parseCaElectionLogistics(await fetchPage(url), url, now);
      const values = {
        addressHash: "__global__",
        endpoint: CA_LOGISTICS_ENDPOINT,
        params: caLogisticsCacheParams(payload.electionDate),
        responseData: payload,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
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
          set: {
            responseData: payload,
            fetchedAt: now,
            expiresAt: values.expiresAt,
          },
        });
    }
  },
};
