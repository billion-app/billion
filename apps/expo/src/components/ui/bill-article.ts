import type { ResolvedArticleBlock } from "@acme/validators";
import { resolveArticleBlocks } from "@acme/validators";

import type { getBillFactFigure } from "./bill-fact-figure";
import type { BillBriefData } from "./BillBrief";
import { getBillDateMilestones } from "./bill-date-milestones";
import { getBillScaleFigure } from "./bill-fact-figure";

type Change = BillBriefData["changes"][number];

// Resolved with the client's brief pieces, which also carry court document IDs
// and generated change images.
export type ArticleBlockData = ResolvedArticleBlock<BillBriefData>;

export type BillArticleData = Pick<
  BillBriefData,
  | "sourceStatus"
  | "sourceLabel"
  | "headline"
  | "summary"
  | "hook"
  | "legalStatus"
  | "terms"
> & { blocks: ArticleBlockData[] };

export type ArticleBlockOf<K extends ArticleBlockData["type"]> = Extract<
  ArticleBlockData,
  { type: K }
>;

/** The shared context a change renderer needs from its article. */
export type BillChangeContext = Pick<
  BillBriefData,
  "changes" | "legalStatus" | "sourceStatus" | "sourceLabel" | "terms"
>;

export function changeContext(
  article: BillArticleData,
  changes: Change[],
): BillChangeContext {
  return {
    changes,
    legalStatus: article.legalStatus,
    sourceStatus: article.sourceStatus,
    sourceLabel: article.sourceLabel,
    terms: article.terms,
  };
}

export function articleBlocks<K extends ArticleBlockData["type"]>(
  article: BillArticleData,
  type: K,
): ArticleBlockOf<K>[] {
  return article.blocks.filter(
    (block): block is ArticleBlockOf<K> => block.type === type,
  );
}

/** Every change in the article, for figures that relate a value to its change. */
export function articleChanges(article: BillArticleData): Change[] {
  return articleBlocks(article, "changes").flatMap((block) => block.items);
}

/**
 * Honor a block's requested visual only when its facts support it. A
 * scale needs two values of one measure and a timeline needs two complete
 * dates; anything else is drawn as metrics rather than implying a comparison.
 */
export function figureForBlock(
  block: ArticleBlockOf<"figure">,
): ReturnType<typeof getBillFactFigure> {
  const scale =
    block.visual === "scale" ? getBillScaleFigure(block.facts) : null;
  if (scale) return scale;
  const [first, ...rest] = block.facts;
  return first ? { kind: "metrics", points: [first, ...rest] } : null;
}

export function figureShowsTimeline(block: ArticleBlockOf<"figure">) {
  return (
    block.visual === "timeline" && getBillDateMilestones(block.facts).length > 0
  );
}

/**
 * Express a brief as an article: the writer's verified layout for a v9 brief,
 * or the order inferred from a v8 brief's content.
 */
export function billArticleFromBrief(
  brief: BillBriefData,
  options: { perspectives?: boolean } = {},
): BillArticleData {
  return {
    sourceStatus: brief.sourceStatus,
    sourceLabel: brief.sourceLabel,
    headline: brief.headline,
    summary: brief.summary,
    hook: brief.hook,
    legalStatus: brief.legalStatus,
    terms: brief.terms,
    blocks: resolveArticleBlocks(brief, options),
  };
}
