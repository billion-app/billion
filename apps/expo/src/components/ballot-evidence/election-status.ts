import type { AppLanguage } from "~/i18n/language";
import { appTranslator } from "~/i18n/app-strings";

/** Labels describe supplied evidence; guide inclusion never proves ballot eligibility. */
export function candidateStatusLabel(
  status: string | undefined,
  inStatementGuide = false,
  language: AppLanguage = "en",
): string {
  const t = appTranslator(language);
  if (status === "withdrewStillOnBallot")
    return t("Withdrawn; name remains listed by the ballot source");
  if (status === "onBallot") return t("Listed by the ballot source");
  if (inStatementGuide)
    return t("Statement guide entry · ballot status unverified");
  return t("Ballot status unknown");
}

export type ElectionCoverage =
  | "verified-complete"
  | "partial"
  | "statement-guide"
  | "unknown";

export function electionCoverageLabel(
  coverage: ElectionCoverage,
  language: AppLanguage = "en",
): string {
  const t = appTranslator(language);
  switch (coverage) {
    case "verified-complete":
      return t("Complete ballot verified against official records");
    case "partial":
      return t(
        "Partial provider data · other contests or candidates may be missing",
      );
    case "statement-guide":
      return t(
        "Statement guide · includes statement submitters, not a complete ballot",
      );
    case "unknown":
      return t(
        "Coverage unknown · missing data does not mean no election or race exists",
      );
  }
}

/** A freshness deadline must come from the evidence owner, never a UI guess. */
export function freshnessLabel(
  evidence: { fetchedAt?: string; staleAfter?: string; conflicting?: boolean },
  now = Date.now(),
  language: AppLanguage = "en",
): string | undefined {
  const t = appTranslator(language);
  if (evidence.conflicting)
    return t("Sources disagree · confirm with your election office");
  if (!evidence.fetchedAt || !Number.isFinite(Date.parse(evidence.fetchedAt)))
    return t("Retrieval date unavailable");
  if (
    evidence.staleAfter &&
    Number.isFinite(Date.parse(evidence.staleAfter)) &&
    now >= Date.parse(evidence.staleAfter)
  )
    return t(
      "Source retrieval is out of date · confirm with your election office",
    );
  return undefined;
}
