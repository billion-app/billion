import { URL } from "node:url";

import type { CourtCase, GovernmentContent } from "@acme/db/schema";

export function governmentSourceDate({
  publishedDate,
  source,
}: Pick<typeof GovernmentContent.$inferSelect, "publishedDate" | "source">) {
  const kind =
    source === "whitehouse.gov"
      ? "whiteHousePublished"
      : source === "federalregister.gov"
        ? "federalRegisterPublished"
        : "published";
  return {
    kind,
    date: publishedDate,
    timeZone: source === "whitehouse.gov" ? "America/New_York" : "UTC",
  } as const;
}

export function courtSourceDate({
  filedDate,
  url,
}: Pick<typeof CourtCase.$inferSelect, "filedDate" | "url">) {
  if (!filedDate) return null;
  const sourceUrl = URL.parse(url);
  const hostname = sourceUrl?.hostname;
  const kind =
    (hostname === "www.supremecourt.gov" || hostname === "supremecourt.gov") &&
    sourceUrl?.pathname.startsWith("/opinions/")
      ? "opinionReleased"
      : hostname === "ecourtrecords.org" || hostname === "www.ecourtrecords.org"
        ? "latestDocketEntry"
        : "courtRecordDated";
  return { kind, date: filedDate, timeZone: "UTC" } as const;
}
