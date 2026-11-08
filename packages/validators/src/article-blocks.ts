/**
 * Bill Article — an ordered composition of typed blocks.
 *
 * A v8 brief is a fixed form: every bill gets the same fields in the same
 * order, and the client guesses which visual a set of facts deserves by
 * pattern-matching their text. That optimizes for generating at scale. An
 * article optimizes for the reader: the writer chooses which blocks a bill
 * needs, in what order, and which visual carries its figures.
 *
 * The block catalog below is the single description of that option space. Each
 * schema's `.describe()` says when to use the block, so the same text reaches
 * the model that composes an article and the reviewer reading this file.
 *
 * The editorial guarantees of the brief carry over unchanged because blocks
 * reuse the brief's own pieces: mechanical change kinds, before/after, verbatim
 * quotes, `unclear` directions, and non-empty unknowns. A block chooses
 * presentation; it never relaxes provenance.
 *
 * Renderers skip block types they do not know. Installed apps lag behind
 * published content, so an unknown block is expected, not an error.
 */
import { z } from "zod";

import {
  BriefAffectedSchema,
  BriefChangeSchema,
  BriefContextSchema,
  BriefDeepDiveSchema,
  BriefFactSchema,
  BriefLegalStatusSchema,
  BriefReadingSchema,
  BriefTermSchema,
} from "./bill-brief";

/**
 * How a figure block draws its facts. The renderer verifies that the facts
 * support the requested visual and falls back to `metrics` when they do not,
 * so a visual can never imply a comparison the source does not make.
 */
export const ArticleFigureVisualSchema = z
  .enum(["scale", "timeline", "metrics"])
  .describe(
    "'scale' places two values of one shared unit on a common axis, such as two proposed thresholds. 'timeline' orders two or more complete calendar dates. 'metrics' shows one leading figure with the rest on demand; use it whenever the values do not share a unit or a chronology.",
  );
export type ArticleFigureVisual = z.infer<typeof ArticleFigureVisualSchema>;

export const ArticleChangesBlockSchema = z
  .object({
    type: z.literal("changes"),
    display: z
      .enum(["explorer", "map"])
      .describe(
        "'explorer' steps through changes one at a time and suits a bill whose figure block already orients the reader. 'map' shows the lead change and an index of the rest; use it when the bill has no figure to anchor the opening.",
      ),
    items: z.array(BriefChangeSchema).min(1).max(5),
  })
  .describe(
    "The consequential provisions, most significant first, each as current law versus the measure.",
  );

export const ArticleFigureBlockSchema = z
  .object({
    type: z.literal("figure"),
    visual: ArticleFigureVisualSchema,
    facts: z.array(BriefFactSchema).min(1).max(4),
  })
  .describe(
    "Figures the source states, drawn with the visual that matches their relationship. Omit the block rather than inventing a number.",
  );

export const ArticleAffectedBlockSchema = z
  .object({
    type: z.literal("affected"),
    items: z.array(BriefAffectedSchema).min(1).max(4),
  })
  .describe("Specific groups on the receiving end of the changes.");

export const ArticleUnknownsBlockSchema = z
  .object({
    type: z.literal("unknowns"),
    items: z.array(z.string().trim().min(15)).min(1).max(3),
  })
  .describe(
    "What the text does not settle. Every article includes this block so it cannot read as more settled than the source.",
  );

export const ArticleGlossaryBlockSchema = z
  .object({ type: z.literal("glossary") })
  .describe(
    "Places the article's terms as a collapsed glossary. The terms themselves stay on the article, where inline definitions also use them.",
  );

export const ArticleContextBlockSchema = z
  .object({ type: z.literal("context"), context: BriefContextSchema })
  .describe(
    "Cited history explaining why the policy was not already adopted. Include only with at least two opened sources.",
  );

export const ArticlePerspectivesBlockSchema = z
  .object({ type: z.literal("perspectives") })
  .describe(
    "Places the separately researched, cited arguments for and against. The debate itself lives in the dual lens, never in the article's own voice.",
  );

export const ArticleFurtherReadingBlockSchema = z
  .object({
    type: z.literal("furtherReading"),
    deepDive: BriefDeepDiveSchema.optional(),
    reading: z.array(BriefReadingSchema).max(4),
  })
  .describe(
    "Billion's optional long-form explainer and researched outside articles for readers who want more depth.",
  );

export const ArticleBlockSchema = z.discriminatedUnion("type", [
  ArticleChangesBlockSchema,
  ArticleFigureBlockSchema,
  ArticleAffectedBlockSchema,
  ArticleUnknownsBlockSchema,
  ArticleGlossaryBlockSchema,
  ArticleContextBlockSchema,
  ArticlePerspectivesBlockSchema,
  ArticleFurtherReadingBlockSchema,
]);
export type ArticleBlock = z.infer<typeof ArticleBlockSchema>;
export type ArticleBlockType = ArticleBlock["type"];

/** The opening every article shares, followed by its chosen blocks. */
export const BillArticleSchema = z.object({
  headline: z.string().trim().min(8).optional(),
  summary: z.string().trim().min(30),
  hook: z.string().trim().min(60),
  legalStatus: BriefLegalStatusSchema,
  terms: z.array(BriefTermSchema).max(5),
  blocks: z.array(ArticleBlockSchema).min(1),
});
export type BillArticle = z.infer<typeof BillArticleSchema>;
