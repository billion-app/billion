export type ReprocessMode = "missing" | "replace";

export type ReprocessContentType = "bill" | "government_content" | "court_case";

export interface ReprocessingState {
  contentType: ReprocessContentType;
  fullText: string | null;
  aiGeneratedArticle: string | null;
  /** Whether a structured brief exists. Bills only — see `needsReprocessing`. */
  hasBrief: boolean;
}

const REQUIRED_ARTICLE_SECTIONS = [
  "what this means for you",
  "overview",
  "impact & implications",
  "the debate",
] as const;

export function isUsableSourceText(
  text: string | undefined | null,
): text is string {
  if (!text || text.length < 200) return false;
  if (/[A-Z]:\\/.test(text)) return false;

  // Markdown uses blank lines for ordinary paragraph spacing. Counting those
  // as boilerplate rejects well-formed Federal Register documents, so assess
  // only meaningful lines here.
  const meaningfulLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (meaningfulLines.length === 0) return false;

  const boilerplateLines = meaningfulLines.filter((trimmed) => {
    if (trimmed.split(/\s+/).length === 1) return true;

    const isAllCaps =
      /[a-zA-Z]/.test(trimmed) &&
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2;
    const isLegislativeHeader =
      /^(SEC\.|SECTION|CHAPTER|TITLE|PART|SUBPART|ART\.|ARTICLE)\s/i.test(
        trimmed,
      );
    return isAllCaps && !isLegislativeHeader;
  });

  return boilerplateLines.length / meaningfulLines.length < 0.5;
}

export function isUsableAIArticle(article: string | undefined | null): boolean {
  if (!article || article.trim().length < 500) return false;

  const normalizedHeadings = [...article.matchAll(/^##\s+(.+)$/gm)].map(
    (match) => match[1]!.trim().toLowerCase(),
  );
  return REQUIRED_ARTICLE_SECTIONS.every((required) =>
    normalizedHeadings.some((heading) => heading === required),
  );
}

/**
 * Which long-form asset a content type is actually read from.
 *
 * Bills render from their structured brief; `article-detail.tsx` only falls
 * back to `aiGeneratedArticle` when no brief exists. Since bills no longer
 * generate an article at all, judging one "incomplete" for lacking an article
 * would select every correctly-stored bill and regenerate the artifact we
 * deliberately stopped producing.
 *
 * Court cases and executive actions have no brief schema yet, so for them the
 * article is still the only long-form content and remains required.
 */
export function requiresBrief(contentType: ReprocessContentType): boolean {
  return contentType === "bill";
}

export function needsReprocessing(
  state: ReprocessingState,
  mode: ReprocessMode,
): boolean {
  if (mode === "replace") return true;

  if (!isUsableSourceText(state.fullText)) return true;
  return requiresBrief(state.contentType)
    ? !state.hasBrief
    : !isUsableAIArticle(state.aiGeneratedArticle);
}
