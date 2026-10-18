import type { AppLanguage } from "~/i18n/language";
import { appTranslator, translateAppLabel } from "~/i18n/app-strings";
import { formatDate } from "~/i18n/format";
import { webUrl } from "../../utils/web-url";

export { webUrl } from "../../utils/web-url";

/** UI evidence only. An empty provider response is not proof of publication status. */
export type BallotEvidence =
  | { kind: "invalid-input" }
  | { kind: "provider-failure" }
  | { kind: "result"; electionKnown: boolean; contestCount: number };

export function ballotStatus(
  evidence: BallotEvidence,
  language: AppLanguage = "en",
) {
  const t = appTranslator(language);
  if (evidence.kind === "invalid-input")
    return {
      title: t("Check your address"),
      detail: t("Enter a complete address and try again."),
    };
  if (evidence.kind === "provider-failure")
    return {
      title: t("We couldn’t load your ballot"),
      detail: t(
        "Try again to load your ballot, or visit your election office for local information.",
      ),
    };
  if (evidence.contestCount > 0)
    return {
      title: t("Partial ballot data"),
      detail: t(
        "Partial provider data · other contests or candidates may be missing. Confirm your complete ballot with your election office.",
      ),
    };
  if (evidence.electionKnown)
    return {
      title: t("Ballot details unavailable"),
      detail: t(
        "Billion has no contest information for this election. Check your election office for the official ballot.",
      ),
    };
  return {
    title: t("No ballot data found"),
    detail: t(
      "Billion found no ballot data for this lookup. This does not mean there is no election.",
    ),
  };
}

/** Structurally accepts existing measure citations; adapters retain candidate field names. */
export interface BallotCitation {
  field: string;
  sourceName: string;
  sourceUrl?: string;
  official?: boolean;
  tier?: string;
  fetchedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  staleAfter?: string;
  conflicting?: boolean;
}

export function verificationLabel(
  citation: BallotCitation,
  language: AppLanguage = "en",
): string {
  const t = appTranslator(language);
  if (
    !citation.verifiedAt ||
    !citation.verifiedBy ||
    !Number.isFinite(Date.parse(citation.verifiedAt))
  )
    return t("Verification date unavailable");
  return t("Last verified {date} by {reviewer}", {
    date: formatDate(language, citation.verifiedAt),
    reviewer: citation.verifiedBy,
  });
}

export interface LanguageEvidence {
  language: string;
  material: string;
  citation: BallotCitation;
}

export function verifiedLanguages(items: readonly LanguageEvidence[]) {
  return items.filter(
    ({ language, material, citation }) =>
      language.trim() &&
      material.trim() &&
      citation.official === true &&
      webUrl(citation.sourceUrl) &&
      citation.verifiedAt &&
      citation.verifiedBy &&
      Number.isFinite(Date.parse(citation.verifiedAt)),
  );
}

/** Present field names as reader-facing labels without changing attribution. */
export function citationFieldLabel(
  field: string,
  language: AppLanguage = "en",
): string {
  const separator = field.indexOf(" · ");
  if (separator > 0)
    return `${field.slice(0, separator)} · ${citationFieldLabel(field.slice(separator + 3), language)}`;
  const labels: Record<string, string> = {
    referendumText: "Original text",
    referendumUrl: "Original text link",
    summary: "Summary",
    summaryShort: "Summary",
    summaryLong: "Summary",
    statement: "Candidate statement",
    statementSummary: "Statement summary",
    biography: "Biography",
    fiscalImpact: "Fiscal impact",
    proArguments: "Arguments in favor",
    conArguments: "Arguments against",
    candidateUrl: "Candidate website",
    photoUrl: "Photo",
    incumbent: "Incumbency",
    referendumProStatement: "Statement in favor",
    referendumConStatement: "Statement against",
  };
  const label = labels[field];
  if (label) return translateAppLabel(language, label);
  const words = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words
    ? words[0]?.toUpperCase() + words.slice(1)
    : translateAppLabel(language, "Content");
}
