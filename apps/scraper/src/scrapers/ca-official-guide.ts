import {
  CA_OFFICIAL_GUIDE_ADDRESS_HASH,
  CA_OFFICIAL_GUIDE_ENDPOINT,
  officialGuideCacheParams,
  officialGuidePayloadSchema,
} from "@acme/api/lib/official-guide-cache";
import { TRILLION_ENDPOINT, trillionSourceUrls } from "@acme/api/lib/trillion";
import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { createLogger } from "../utils/log.js";
import { collectOfficialGuide } from "./ca-official-guide-source.js";
import { caOfficialGuideConfig } from "./ca-official-guide.config.js";
import { collectRelationshipDocumentHashes } from "./measure-relationship-source.js";

const logger = createLogger("ca-official-guide");
export const caOfficialGuide: Scraper = {
  ...caOfficialGuideConfig,
  async scrape(options) {
    const electionDate = process.env.CA_GUIDE_ELECTION_DATE;
    if (!electionDate) throw new Error("CA_GUIDE_ELECTION_DATE is required");
    const payload = await collectOfficialGuide(
      electionDate,
      options?.maxItems ?? Number(process.env.CA_GUIDE_MAX_ITEMS ?? 40),
    );
    if (!payload.complete)
      throw new Error(
        "Page limit stopped collection; refusing to replace the complete cache. Use the read-only collector to sample pages.",
      );
    if (!payload.measures.length && !payload.candidates.length)
      throw new Error("No official guide content collected");
    // Stored Trillion graphs publish only while their source documents still match.
    const trillionGraphs = await db
      .select({ responseData: CivicApiCache.responseData })
      .from(CivicApiCache)
      .where(eq(CivicApiCache.endpoint, TRILLION_ENDPOINT));
    payload.relationshipSources = await collectRelationshipDocumentHashes(
      electionDate,
      undefined,
      trillionSourceUrls(trillionGraphs.map((row) => row.responseData)),
    );
    // Readers parse this row on every request; one invalid field hides the
    // whole guide, so it is never written unless it parses.
    const checked = officialGuidePayloadSchema.safeParse(payload);
    if (!checked.success)
      throw new Error(
        `Refusing to cache a guide readers cannot parse: ${checked.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    const fetchedAt = new Date(payload.fetchedAt);
    const values = {
      addressHash: CA_OFFICIAL_GUIDE_ADDRESS_HASH,
      endpoint: CA_OFFICIAL_GUIDE_ENDPOINT,
      params: officialGuideCacheParams(electionDate),
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
    logger.success(
      `Cached ${payload.measures.length} measures and ${payload.candidates.length} candidate statements for ${electionDate}`,
    );
  },
};
