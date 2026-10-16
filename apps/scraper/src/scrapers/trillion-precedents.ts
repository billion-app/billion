import { z } from "zod/v4";

/**
 * Curated historical precedent for Trillion graphs (#455), keyed by election
 * and measure. The pipeline finds the current guide on its own, but nothing
 * yet tells it which earlier measures, audits, or reports are comparable, so a
 * person picks them here. Each entry is an archived official PDF; `pages`
 * limits the capture to the passages that matter so the prompt stays bounded.
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
