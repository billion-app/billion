export type ReprocessMode = "missing" | "replace";

export interface ReprocessingState {
  fullText: string | null;
  aiGeneratedArticle: string | null;
  videoId: string | null;
  videoImageData: Buffer | null;
  videoThumbnailUrl: string | null;
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

export function hasVideoImage(state: ReprocessingState): boolean {
  return Boolean(state.videoImageData || state.videoThumbnailUrl);
}

export function needsReprocessing(
  state: ReprocessingState,
  mode: ReprocessMode,
): boolean {
  if (!isUsableSourceText(state.fullText)) return false;
  if (mode === "replace") return true;

  return (
    !isUsableAIArticle(state.aiGeneratedArticle) ||
    !state.videoId ||
    !hasVideoImage(state)
  );
}
