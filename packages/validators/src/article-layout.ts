/**
 * Article layout — the writer's composition of a brief's verified content.
 *
 * A layout chooses which blocks a bill needs, their order, and which visual
 * carries its figures. It references the brief's content by position instead
 * of copying it, so every existing guarantee on that content (verbatim quotes,
 * framing and jargon lints, the translation allowlist) applies unchanged, and
 * readers that predate layouts keep rendering the same brief.
 *
 * Each block's `.describe()` is the guidance the writer receives, making this
 * file the single description of the option space. `verifyArticleLayout`
 * (article-blocks.ts) enforces the rules in code before a layout is stored.
 *
 * Deliberately free of imports from bill-brief.ts, which embeds this schema.
 */
import { z } from "zod";

export const ArticleFigureVisualSchema = z
  .enum(["scale", "timeline", "metrics"])
  .describe(
    "'scale' places exactly two proposed thresholds of one unit on a shared axis, such as two heat-index triggers; each value is written as the number, unit and measure (\"87°F heat index\") with a note saying it is proposed. 'timeline' orders two or more complete calendar dates written like \"January 1, 2027\". 'metrics' shows one leading figure with the rest on demand, and a bare percentage such as \"20%\" is drawn on a 0–100% axis. Use 'metrics' whenever values do not share a unit or a chronology.",
  );
export type ArticleFigureVisual = z.infer<typeof ArticleFigureVisualSchema>;

const positions = (list: string) =>
  z
    .array(z.number().int().min(0))
    .min(1)
    .describe(`Zero-based positions in the brief's "${list}" list.`);

export const ArticleLayoutBlockSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("changes"),
      display: z
        .enum(["explorer", "map"])
        .describe(
          "'explorer' steps through the changes one at a time and suits an article whose figure block already orients the reader. 'map' explains the lead change and indexes the rest; use it when no figure anchors the opening.",
        ),
      items: positions("changes"),
    })
    .describe(
      "Provisions, most consequential first. Every change must appear in some changes block; any you leave out are appended, so do not hide one by omission.",
    ),
  z
    .object({
      type: z.literal("figure"),
      visual: ArticleFigureVisualSchema,
      facts: positions("facts"),
    })
    .describe(
      "Figures drawn together because they share a relationship. Split unrelated figures into separate blocks; put a figure first only when it is the clearest way into the bill. A visual the facts do not support is drawn as metrics.",
    ),
  z
    .object({ type: z.literal("affected") })
    .describe("Who the changes land on. Always included."),
  z
    .object({ type: z.literal("unknowns") })
    .describe(
      "What the text does not settle. Always included, so the article cannot read as more settled than the source.",
    ),
  z
    .object({ type: z.literal("glossary") })
    .describe(
      "A collapsed glossary of the terms. Omit it when every term is already explained where it appears.",
    ),
  z
    .object({ type: z.literal("context") })
    .describe(
      'The cited "why not before" history. Include it only when "whyNotBefore" is present.',
    ),
  z
    .object({ type: z.literal("perspectives") })
    .describe(
      "Where the separately researched arguments for and against appear. Readers add it before further reading when you omit it.",
    ),
  z
    .object({ type: z.literal("furtherReading") })
    .describe(
      "The deep dive and outside reading, for readers who choose more depth. Include it only when either exists.",
    ),
]);
export type ArticleLayoutBlock = z.infer<typeof ArticleLayoutBlockSchema>;

export const ArticleLayoutSchema = z
  .array(ArticleLayoutBlockSchema)
  .min(1)
  .describe(
    "The order a reader meets this bill. Choose blocks for what a newcomer needs first: the opening summary is already shown above them. Most bills lead with their changes; lead with a figure only when a number, threshold or deadline is the clearest way in.",
  );
export type ArticleLayout = z.infer<typeof ArticleLayoutSchema>;

/**
 * The catalog as writer guidance, rendered from the schema descriptions above
 * so the prompt and the schema cannot drift apart.
 */
export function describeArticleLayoutCatalog(): string {
  const blocks = ArticleLayoutBlockSchema.options.map((option) => {
    const shape = option.shape as Record<string, z.ZodType | undefined>;
    const details = (["display", "visual"] as const)
      .map((field) => shape[field]?.description)
      .filter(Boolean)
      .map((text) => `\n    ${text}`)
      .join("");
    return `  - "${option.shape.type.value}": ${option.description}${details}`;
  });
  return [ArticleLayoutSchema.description, ...blocks].join("\n");
}
