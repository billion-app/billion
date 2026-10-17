import { z } from "zod/v4";

/**
 * Curated historical precedent for Trillion graphs (#455), keyed by election
 * and measure. The pipeline finds the current guide on its own, but nothing
 * yet tells it which earlier measures, audits, or reports are comparable, so a
 * person picks them here. Entries are official PDFs or LAO publication reports; `pages`
 * limits PDF capture to the passages that matter so the prompt stays bounded.
 */
export const trillionPrecedentSchema = z.object({
  id: z.string().regex(/^precedent-[a-z0-9-]+$/),
  url: z.url(),
  title: z.string().trim().min(1).max(200),
  locator: z.string().trim().min(1).max(300),
  pages: z.tuple([z.number().int().min(1), z.number().int().min(1)]).optional(),
});
export type TrillionPrecedent = z.infer<typeof trillionPrecedentSchema>;

export const TRILLION_PRECEDENTS: Record<string, TrillionPrecedent[]> = {
  "2026-11-03:1": [
    {
      id: "precedent-housing-audit",
      url: "https://information.auditor.ca.gov/pdfs/reports/2020-108.pdf",
      title:
        "State Auditor, Report 2020-108: California's Housing Agencies (November 2020)",
      locator:
        "Summary, report pages 1–4; historical findings, not a current program evaluation",
      pages: [7, 10],
    },
  ],
  "2026-11-03:2": [
    {
      id: "precedent-rebate-budget-2022",
      url: "https://lao.ca.gov/Publications/Report/4631",
      title:
        "Legislative Analyst, The 2022–23 Spending Plan: State Appropriations Limit (September 2022)",
      locator:
        "Major SAL-Related Decisions; taxpayer rebates and excluded spending in the enacted budget",
    },
    {
      id: "precedent-spending-limit",
      // The HTML report preserves reading order; its two-column PDF interleaves prose.
      url: "https://lao.ca.gov/Publications/Report/4416",
      title: "Legislative Analyst, The State Appropriations Limit (April 2021)",
      locator:
        "Historical operation and rebate rules; projections are as of April 2021",
    },
    {
      id: "precedent-reserve-policy",
      url: "https://www.lao.ca.gov/reports/2025/5028/Rethinking-Californias-Reserve-Policy-041025.pdf",
      title:
        "Legislative Analyst, Rethinking California's Reserve Policy (April 2025)",
      locator:
        "Reserve deposits, withdrawals, historical balances and policy tradeoffs as of April 2025",
    },
  ],
  // Prop 40 (2026): a one-time tax on billionaires' wealth, mostly for health care.
  "2026-11-03:40": [
    {
      // Prop 63 (2004) taxed incomes over $1 million to fund mental health.
      // The audit is the closest record of how an earmarked tax on the very
      // rich was actually spent.
      id: "precedent-mhsa-audit",
      url: "https://information.auditor.ca.gov/pdfs/reports/2017-117.pdf",
      title:
        "State Auditor, Report 2017-117: Mental Health Services Act (February 2018)",
      locator: "Summary, report pages 1–2",
      pages: [7, 8],
    },
    {
      // Prop 55 (2016) extended Prop 30's "temporary" high-earner taxes, and
      // its analysis explains why revenue from the very rich swings.
      id: "precedent-prop55",
      url: "https://www.lao.ca.gov/ballot/2016/Prop55-110816.pdf",
      title:
        "Legislative Analyst, Proposition 55 analysis (November 2016 ballot)",
      locator: "Yes/No statement and fiscal analysis",
    },
  ],
};

export function trillionPrecedents(
  electionDate: string,
  number: string,
): TrillionPrecedent[] {
  return z
    .array(trillionPrecedentSchema)
    .max(4)
    .parse(TRILLION_PRECEDENTS[`${electionDate}:${number}`] ?? []);
}
