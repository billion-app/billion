import type { loadContentDetail } from "./content-detail";
import type { TranslationLanguage } from "./content-translation";
import {
  applySegments,
  hashReaderSource,
  readerTranslationSource,
} from "./content-translation";
import { getTranslations } from "./content-translation-store";

export async function translateContentDetail(
  detail: Awaited<ReturnType<typeof loadContentDetail>>,
  language: TranslationLanguage,
  expectedHash?: string,
) {
  const source = readerTranslationSource(detail);
  const sourceHash = hashReaderSource(source);
  if (expectedHash && expectedHash !== sourceHash) {
    return {
      status: "stale" as const,
      language: language,
      sourceHash,
    };
  }
  const brief = "brief" in detail ? detail.brief : null;
  const courtBrief = "courtBrief" in detail ? detail.courtBrief : null;
  const translations = await getTranslations({
    contentId: detail.id,
    contentType: detail.type,
    language: language,
    source,
  });
  if (!translations) {
    return {
      status: "unavailable" as const,
      language: language,
      sourceHash,
    };
  }
  return {
    status: "translated" as const,
    language: language,
    sourceHash,
    title: translations.title ?? detail.title,
    description: translations.description ?? detail.description,
    articleContent: translations.articleContent ?? null,
    brief: applySegments(brief, translations, "brief"),
    courtBrief: applySegments(courtBrief, translations, "courtBrief"),
    lensData: applySegments(detail.lensData, translations, "lensData"),
    actions: applySegments(
      "actions" in detail ? detail.actions : [],
      translations,
      "actions",
    ),
  };
}
