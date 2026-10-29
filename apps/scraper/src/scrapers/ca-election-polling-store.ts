import type { CaliforniaPollingReport } from "@acme/api/lib/california-polling";
import type { db } from "@acme/db/client";
import {
  CA_POLLING_ADDRESS_HASH,
  CA_POLLING_ENDPOINT,
  californiaPollingReportSchema,
  pollingCacheParams,
} from "@acme/api/lib/california-polling";
import { CivicApiCache } from "@acme/db/schema";

export async function storeCaliforniaPollingReport(
  database: typeof db,
  input: CaliforniaPollingReport,
): Promise<void> {
  const report = californiaPollingReportSchema.parse(input);
  const fetchedAt = new Date(report.retrievedAt);
  const expiresAt = new Date(`${report.electionDate}T00:00:00Z`);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  await database
    .insert(CivicApiCache)
    .values({
      addressHash: CA_POLLING_ADDRESS_HASH,
      endpoint: CA_POLLING_ENDPOINT,
      params: pollingCacheParams(report),
      responseData: report,
      fetchedAt,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        CivicApiCache.addressHash,
        CivicApiCache.endpoint,
        CivicApiCache.params,
      ],
      set: { responseData: report, fetchedAt, expiresAt },
    });
}
