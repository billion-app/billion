import { getBillFactDisplay, getBillPercent } from "@acme/validators";

import type { BillBriefData } from "./BillBrief";

export { getBillPercent, getBillVisualKind } from "@acme/validators";

/** Keep explicit numeric limits and conditions beside the metric, while
 * supporting prose remains available in its details disclosure. */
export function isEssentialMetricNote(note: string) {
  return /\d|\b(?:only|unless|except|whichever|minimum|maximum|at least|at most|must|not|no|if|when|means|measures)\b|仅|除非|至少|最多|必须|不得|不|solo|sólo|excepto|debe|mínimo|máximo|significa|表示/iu.test(
    note,
  );
}

/** A fact and change must cite the same nonempty passage in the same document.
 * Reuse a complete short baseline; never derive a current value from silence,
 * subtract percentages, or confuse a required minimum with observed uptake. */
export function getBillMetricComparison(
  fact: BillBriefData["facts"][number],
  changes: BillBriefData["changes"],
): string | null {
  if (!getBillFactDisplay(fact.value).numeric) return null;
  const normalize = (text: string) =>
    text.replaceAll("**", "").replace(/\s+/gu, " ").trim();
  const quote = normalize(fact.quote?.text ?? "");
  if (!quote) return null;
  const matches = changes.filter(
    (change) =>
      normalize(change.quote?.text ?? "") === quote &&
      (change.quote?.documentId ?? "") === (fact.quote?.documentId ?? ""),
  );
  if (matches.length !== 1) return null;
  const baseline = normalize(matches[0]?.before ?? "");
  // Long or missing context stays in the full comparison, without truncation.
  return baseline && baseline.length <= 160 ? baseline : null;
}

/** One leading visual: prefer a supported percentage, otherwise the first
 * supplied fact. The renderer retains the complete list behind More figures. */
export function getPrimaryMetricFacts(facts: BillBriefData["facts"]) {
  const lead =
    facts.find((fact) => getBillPercent(fact.value) !== null) ?? facts[0];
  return lead ? [lead] : [];
}
