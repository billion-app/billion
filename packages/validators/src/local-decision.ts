import { z } from "zod";

export const LocalDecisionClaimsSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(600),
        citations: z
          .array(
            z.object({
              documentId: z.string().uuid(),
              page: z.number().int().positive(),
              quote: z.string().trim().min(20).max(1000),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .min(1)
    .max(5),
});

export const LocalDecisionBriefSchema = LocalDecisionClaimsSchema.extend({
  generatedAt: z.string().datetime(),
  sourceContext: z.string().min(1),
  version: z.literal(1),
  language: z.literal("en"),
  sourceHashes: z.record(z.string().uuid(), z.string().regex(/^[a-f0-9]{64}$/)),
});

export type LocalDecisionBrief = z.infer<typeof LocalDecisionBriefSchema>;

export interface LocalDecisionBriefDocument {
  id: string;
  contentHash: string | null;
  extractedPages: string[] | null;
  processingPolicy: string;
  extractionStatus: string;
  isPublicComment: boolean;
  sourceDeletedAt: Date | string | null;
}

export function isLocalBriefSource(
  document: LocalDecisionBriefDocument,
): boolean {
  return (
    !document.isPublicComment &&
    document.sourceDeletedAt === null &&
    document.processingPolicy === "extract_text" &&
    document.extractionStatus === "native" &&
    document.contentHash !== null &&
    /^[a-f0-9]{64}$/.test(document.contentHash) &&
    document.extractedPages?.some((page) => page.trim().length > 0) === true
  );
}

function normalizedText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function validateLocalDecisionBrief(
  value: unknown,
  documents: readonly LocalDecisionBriefDocument[],
  sourceContext: string,
): LocalDecisionBrief | null {
  const parsed = LocalDecisionBriefSchema.safeParse(value);
  if (!parsed.success) return null;
  const brief = parsed.data;
  if (brief.sourceContext !== sourceContext) return null;
  const sources = new Map(documents.map((document) => [document.id, document]));
  const currentSources = documents.filter(isLocalBriefSource);
  if (
    currentSources.length === 0 ||
    Object.keys(brief.sourceHashes).length !== currentSources.length ||
    currentSources.some((document) => !brief.sourceHashes[document.id])
  )
    return null;
  for (const [id, hash] of Object.entries(brief.sourceHashes)) {
    const document = sources.get(id);
    if (
      !document ||
      !isLocalBriefSource(document) ||
      document.contentHash !== hash
    )
      return null;
  }
  for (const claim of brief.claims) {
    for (const citation of claim.citations) {
      const document = sources.get(citation.documentId);
      const page = document?.extractedPages?.[citation.page - 1];
      if (
        !document ||
        !brief.sourceHashes[document.id] ||
        !page ||
        !normalizedText(page).includes(normalizedText(citation.quote))
      )
        return null;
    }
  }
  return brief;
}

export function computeLocalDecisionSourceContext(input: {
  title: string;
  status: string | null;
  sourceUpdatedAt: Date | string;
  occurrences: readonly {
    id: string;
    startsAt: Date | string | null;
    action: string | null;
    proposedAction: string | null;
    passed: string | null;
    tally: string | null;
  }[];
}): string {
  const date = (value: Date | string) => new Date(value).toISOString();
  return JSON.stringify({
    title: input.title,
    status: input.status,
    sourceUpdatedAt: date(input.sourceUpdatedAt),
    occurrences: [...input.occurrences]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        startsAt: item.startsAt === null ? null : date(item.startsAt),
        action: item.action,
        proposedAction: item.proposedAction,
        passed: item.passed,
        tally: item.tally,
      })),
  });
}
