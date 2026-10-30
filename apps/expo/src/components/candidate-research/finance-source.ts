import type { CandidateBrief } from "@acme/validators";

export function financeFilingSource(
  evidence: readonly Pick<
    CandidateBrief["evidence"][number],
    "origin" | "url" | "title" | "publisher"
  >[],
) {
  const source = evidence.find(
    (item) =>
      item.origin === "primary_record" &&
      ["https://powersearch.sos.ca.gov/", "https://www.fec.gov/data/"].includes(
        item.url,
      ),
  );
  return source
    ? { label: source.title ?? source.publisher, url: source.url }
    : undefined;
}

/** Resource routing only; never identifies a candidate's committee or donor. */
export function financeResearchSource(state?: string, office?: string) {
  const normalized = (office ?? "").toLowerCase().replace(/\./g, "").trim();
  const federal =
    /\b(united states|us)\s+(senate|senator|house|representative|congress|president)\b/.test(
      normalized,
    ) ||
    /^(president|president of the united states|member of congress|congressional representative)$/.test(
      normalized,
    );
  if (federal)
    return {
      label: "Search federal campaign filings · FEC",
      url: "https://www.fec.gov/data/",
    };
  if (state?.toUpperCase() === "CA")
    return {
      label: "Find California state & local filing portals · FPPC",
      url: "https://www.fppc.ca.gov/search-filings/",
    };
  return {
    label: "Find your state election office",
    url: "https://www.usa.gov/state-election-office",
  };
}
