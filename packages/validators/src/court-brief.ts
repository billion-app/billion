import { z } from "zod/v4";

export const COURT_BRIEF_VERSION = 1;
export const COURT_BRIEF_GENERATOR_VERSION = "court-brief-v1";

const text = z.string().trim().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const SourceSchema = z.object({
  id: text,
  url: z.url().refine((url) => /^https?:\/\//.test(url)),
  contentHash: hash,
});
export const CourtBriefPointSchema = z.object({
  text,
  // Required even when no useful verbatim passage is available.
  documentIds: z.array(text).min(1).max(6),
  quote: z
    .object({ text, documentId: text, locator: text.nullable() })
    .nullable(),
});
export const CourtBriefTermSchema = z.object({
  term: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe(
      "The exact legal word or short phrase used in the generated brief.",
    ),
  plain: z
    .string()
    .trim()
    .min(1)
    .max(280)
    .describe("A concise, self-contained definition in everyday language."),
});
export const CourtBriefSchema = z.object({
  takeaway: CourtBriefPointSchema,
  action: CourtBriefPointSchema.describe(
    "The specific relief granted or denied, distinct from the ultimate merits.",
  ),
  posture: text.describe(
    "What request the court is deciding; explicitly say when the record does not establish it.",
  ),
  questions: z.array(CourtBriefPointSchema).max(4),
  reasoning: z
    .array(
      CourtBriefPointSchema.extend({
        kind: z.enum([
          "holding",
          "court_reasoning",
          "party_argument",
          "allegation",
        ]),
      }),
    )
    .max(6),
  effects: z
    .array(
      CourtBriefPointSchema.extend({
        group: text,
        certainty: z.enum(["court_order", "possible_effect"]),
      }),
    )
    .max(4),
  opinions: z
    .array(
      CourtBriefPointSchema.extend({
        kind: z.enum([
          "majority",
          "per_curiam",
          "concurrence",
          "dissent",
          "unknown",
        ]),
        author: text.nullable(),
      }),
    )
    .max(6),
  unknowns: z.array(text).min(1).max(5),
  terms: z
    .array(CourtBriefTermSchema)
    .max(8)
    .describe(
      "Legal jargon used in the brief that a general reader may not know. Use the exact displayed wording and explain it in everyday language.",
    ),
});
export const CourtBriefRecordSchema = CourtBriefSchema.extend({
  version: z.literal(COURT_BRIEF_VERSION),
  generatorVersion: z.literal(COURT_BRIEF_GENERATOR_VERSION),
  sourceHash: hash,
  sources: z.array(SourceSchema).min(1),
  court: text,
  docket: text,
  decisionDate: z.iso.date().nullable(),
  proceeding: z.enum(["emergency_order", "order", "merits_opinion", "unknown"]),
  generatedAt: z.iso.datetime(),
  modelVersion: text,
  verifiedQuotes: z.number().int().nonnegative(),
}).superRefine((brief, ctx) => {
  const ids = new Set(brief.sources.map((source) => source.id));
  if (ids.size !== brief.sources.length)
    ctx.addIssue({ code: "custom", message: "Duplicate document IDs" });
  const points = [
    brief.takeaway,
    brief.action,
    ...brief.questions,
    ...brief.reasoning,
    ...brief.effects,
    ...brief.opinions,
  ];
  for (const point of points) {
    if (
      point.documentIds.some((id) => !ids.has(id)) ||
      (point.quote && !point.documentIds.includes(point.quote.documentId))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Unknown or unattributed source document",
      });
    }
  }
  if (
    brief.proceeding !== "merits_opinion" &&
    brief.reasoning.some((point) => point.kind === "holding")
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "An order or unknown posture cannot be labelled a merits holding",
    });
  }
});

export type CourtBrief = z.infer<typeof CourtBriefSchema>;
export type CourtBriefRecord = z.infer<typeof CourtBriefRecordSchema>;

/** Court source adapters keep separately published PDFs in the original text. */
export function courtSourceDocuments(fullText: string, url: string) {
  const markers = [...fullText.matchAll(/^Source: (https?:\/\/\S+)\s*\n/gm)];
  if (!markers.length) return [{ id: "document-1", url, text: fullText }];
  return markers.map((marker, index) => ({
    id: `document-${index + 1}`,
    url: marker[1] ?? url,
    text: fullText
      .slice(marker.index + marker[0].length, markers[index + 1]?.index)
      .trim(),
  }));
}

export function parseCourtBriefRecord(
  value: unknown,
  sourceHash: string | null | undefined,
): CourtBriefRecord | null {
  const result = CourtBriefRecordSchema.safeParse(value);
  return result.success && result.data.sourceHash === sourceHash
    ? result.data
    : null;
}
