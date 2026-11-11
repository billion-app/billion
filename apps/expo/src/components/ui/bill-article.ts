import type { ArticleFigureVisual } from "@acme/validators";

import type { BillBriefData } from "./BillBrief";
import { getBillDateMilestones } from "./bill-date-milestones";
import { getBillFactFigure } from "./bill-fact-figure";
import { getBillVisualKind } from "./bill-visual";

type Change = BillBriefData["changes"][number];
type Fact = BillBriefData["facts"][number];

// Mirrors @acme/validators' ArticleBlock with the client's brief pieces, which
// also carry court document IDs and generated change images.
export type ArticleBlockData =
  | { type: "changes"; display: "explorer" | "map"; items: Change[] }
  | { type: "figure"; visual: ArticleFigureVisual; facts: Fact[] }
  | { type: "affected"; items: BillBriefData["affected"] }
  | { type: "unknowns"; items: string[] }
  | { type: "glossary" }
  | { type: "context"; context: NonNullable<BillBriefData["whyNotBefore"]> }
  | { type: "perspectives" }
  | {
      type: "furtherReading";
      deepDive?: BillBriefData["deepDive"];
      reading: NonNullable<BillBriefData["reading"]>;
    };

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
 * scale needs two thresholds in one unit and a timeline needs two complete
 * dates; anything else is drawn as metrics rather than implying a comparison.
 */
export function figureForBlock(
  block: ArticleBlockOf<"figure">,
): ReturnType<typeof getBillFactFigure> {
  const figure = getBillFactFigure(block.facts);
  if (figure?.kind !== "temperature" || block.visual === "scale") return figure;
  const [first, ...rest] = block.facts;
  return first ? { kind: "metrics", points: [first, ...rest] } : null;
}

export function figureShowsTimeline(block: ArticleBlockOf<"figure">) {
  return (
    block.visual === "timeline" && getBillDateMilestones(block.facts).length > 0
  );
}

/**
 * Express a v8 brief as an article. The brief's fixed order becomes the block
 * order, and the visual the client used to infer from fact text is recorded on
 * the figure block, so stored articles and adapted briefs render identically.
 */
export function billArticleFromBrief(
  brief: BillBriefData,
  options: { perspectives?: boolean } = {},
): BillArticleData {
  const figure = getBillFactFigure(brief.facts);
  const visual: ArticleFigureVisual =
    figure?.kind === "temperature"
      ? "scale"
      : getBillDateMilestones(brief.facts).length
        ? "timeline"
        : "metrics";
  const reading = brief.reading ?? [];
  const blocks: (ArticleBlockData | null)[] = [
    brief.changes.length
      ? {
          type: "changes",
          display:
            getBillVisualKind(brief.facts) === "changes" ? "map" : "explorer",
          items: brief.changes,
        }
      : null,
    brief.facts.length ? { type: "figure", visual, facts: brief.facts } : null,
    brief.affected.length ? { type: "affected", items: brief.affected } : null,
    brief.unknowns.length ? { type: "unknowns", items: brief.unknowns } : null,
    brief.terms.length ? { type: "glossary" } : null,
    brief.whyNotBefore
      ? { type: "context", context: brief.whyNotBefore }
      : null,
    options.perspectives ? { type: "perspectives" } : null,
    brief.deepDive || reading.length
      ? { type: "furtherReading", deepDive: brief.deepDive, reading }
      : null,
  ];
  return {
    sourceStatus: brief.sourceStatus,
    sourceLabel: brief.sourceLabel,
    headline: brief.headline,
    summary: brief.summary,
    hook: brief.hook,
    legalStatus: brief.legalStatus,
    terms: brief.terms,
    blocks: blocks.filter((block): block is ArticleBlockData => block !== null),
  };
}
