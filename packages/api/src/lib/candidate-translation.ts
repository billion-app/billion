import { createHash } from "node:crypto";

import type { PublishedCandidateRace } from "./candidate-race-release";
import type { TranslationLanguage } from "./content-translation";
import { applySegments, collectSegments } from "./content-translation";

const points = [
  "research.promises.*.brief.change",
  "research.promises.*.brief.authority",
  "research.promises.*.brief.unknowns",
  ...[
    "benefits",
    "costs",
    "affected",
    "perspectives",
    "steps",
    "alternatives",
    "unknowns",
  ].map((key) => `research.promises.*.${key}.*`),
  "research.finance.donors.*.lobbying",
  "research.finance.donors.*.positions.*",
];
export const CANDIDATE_FIELDS = [
  "sections.*.claims.*.text",
  "sections.*.claims.*.emphasis.*",
  "sections.*.missingEvidence",
  "correction.reason",
  "research.terms.*.term",
  "research.terms.*.plain",
  "research.promises.*.title",
  "research.financeGap",
  "research.finance.coverageNote",
  "research.finance.observation.summary.reason",
  "research.finance.observation.donorSelection.reason",
  "research.finance.observation.donorSelection.selection",
  "research.finance.observation.independentExpenditures.reason",
  "research.finance.observation.filingStatus.reason",
  "evidence.*.shows",
  "evidence.*.limits",
  ...points.flatMap((point) => [
    `${point}.title`,
    `${point}.text`,
    `${point}.emphasis.*`,
  ]),
];
export function candidateSegments(race: PublishedCandidateRace) {
  return collectSegments(
    race,
    [
      "manifest.office",
      "manifest.jurisdictionLabel",
      ...CANDIDATE_FIELDS.map((field) => `briefs.*.${field}`),
    ],
    "race",
  );
}
export function candidateTranslationId(id: string) {
  const hex = createHash("sha256")
    .update(`billion:candidate-reader:${id}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
/** Call only after readCandidateRace validates policy, expiry, evidence and review digests. */
export async function localizeCandidateRace(
  race: PublishedCandidateRace,
  language: "en" | TranslationLanguage = "en",
) {
  if (language === "en")
    return { ...race, translationState: "original" as const };
  try {
    const { getSegmentTranslations } =
      await import("./content-translation-store");
    const translations = await getSegmentTranslations({
      contentId: candidateTranslationId(race.manifest.id),
      contentType: "candidate",
      language,
      segments: candidateSegments(race),
    });
    return {
      ...(translations ? applySegments(race, translations, "race") : race),
      translationState: translations
        ? ("translated" as const)
        : ("pending" as const),
    };
  } catch (error) {
    console.error("Candidate translation unavailable", error);
    return { ...race, translationState: "unavailable" as const };
  }
}

export async function localizeCandidateCatalog<
  T extends { id: string; office: string; jurisdiction: string },
>(rows: T[], language: "en" | TranslationLanguage) {
  if (language === "en" || !rows.length)
    return rows.map((row) => ({
      ...row,
      translationState: "original" as const,
    }));
  try {
    const { getSegmentTranslationsMany } =
      await import("./content-translation-store");
    const payloads = await getSegmentTranslationsMany(
      rows.map((row) => ({
        contentId: candidateTranslationId(`catalog:${row.id}`),
        contentType: "candidate" as const,
        language,
        segments: collectSegments(row, ["office", "jurisdiction"], "catalog"),
      })),
    );
    return rows.map((row, index) => ({
      ...(payloads[index]
        ? applySegments(row, payloads[index], "catalog")
        : row),
      translationState: payloads[index]
        ? ("translated" as const)
        : ("pending" as const),
    }));
  } catch (error) {
    console.error("Candidate catalog translation unavailable", error);
    return rows.map((row) => ({
      ...row,
      translationState: "unavailable" as const,
    }));
  }
}
