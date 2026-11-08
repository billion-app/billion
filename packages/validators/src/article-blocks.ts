/**
 * Bill Article — the ordered blocks a reader renders.
 *
 * A v8 brief is a fixed form: every bill gets the same fields in the same
 * order, and readers guessed which visual a set of facts deserved by matching
 * their text. An article is composed for the reader instead. A v9 brief
 * carries the writer's `layout` (article-layout.ts), which this module checks
 * and resolves into blocks; older briefs get a layout inferred from their
 * facts, so every reader renders one shape.
 *
 * The editorial guarantees of the brief carry over unchanged because blocks
 * reuse the brief's own pieces: mechanical change kinds, before/after, verbatim
 * quotes, `unclear` directions, and non-empty unknowns. A layout chooses
 * presentation; it never relaxes provenance or hides content.
 *
 * Renderers skip block types they do not know. Installed apps lag behind
 * published content, so an unknown block is expected, not an error.
 */
import { z } from "zod";

import type { ArticleFigureVisual, ArticleLayout } from "./article-layout";
import type { FigureFact } from "./bill-figures";
import { ArticleFigureVisualSchema } from "./article-layout";
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
import {
  getBillDateMilestones,
  getBillFactFigure,
  getBillScaleFigure,
  getBillVisualKind,
} from "./bill-figures";

/* ---------- Resolved article catalog ---------- */
// When-to-use guidance lives on the layout schemas the writer receives.

export const ArticleBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("changes"),
    display: z.enum(["explorer", "map"]),
    items: z.array(BriefChangeSchema).min(1),
  }),
  z.object({
    type: z.literal("figure"),
    visual: ArticleFigureVisualSchema,
    facts: z.array(BriefFactSchema).min(1),
  }),
  z.object({
    type: z.literal("affected"),
    items: z.array(BriefAffectedSchema).min(1),
  }),
  z.object({
    type: z.literal("unknowns"),
    items: z.array(z.string().trim().min(15)).min(1),
  }),
  z.object({ type: z.literal("glossary") }),
  z.object({ type: z.literal("context"), context: BriefContextSchema }),
  z.object({ type: z.literal("perspectives") }),
  z.object({
    type: z.literal("furtherReading"),
    deepDive: BriefDeepDiveSchema.optional(),
    reading: z.array(BriefReadingSchema),
  }),
]);
export type ArticleBlock = z.infer<typeof ArticleBlockSchema>;
export type ArticleBlockType = ArticleBlock["type"];

/** The opening every article shares, followed by its blocks. */
export const BillArticleSchema = z.object({
  headline: z.string().trim().min(8).optional(),
  summary: z.string().trim().min(30),
  hook: z.string().trim().min(60),
  legalStatus: BriefLegalStatusSchema,
  terms: z.array(BriefTermSchema),
  blocks: z.array(ArticleBlockSchema).min(1),
});
export type BillArticle = z.infer<typeof BillArticleSchema>;

/* ---------- Layout verification and resolution ---------- */

/**
 * The brief content a layout can reference. Generic so the app's richer brief
 * types (court document IDs, generated change images) survive resolution.
 */
export interface ArticleSource {
  facts: readonly FigureFact[];
  changes: readonly unknown[];
  affected: readonly unknown[];
  unknowns: readonly string[];
  terms: readonly unknown[];
  whyNotBefore?: unknown;
  deepDive?: unknown;
  reading?: readonly unknown[];
  layout?: ArticleLayout;
}

export type ResolvedArticleBlock<S extends ArticleSource> =
  | {
      type: "changes";
      display: "explorer" | "map";
      items: S["changes"][number][];
    }
  | { type: "figure"; visual: ArticleFigureVisual; facts: S["facts"][number][] }
  | { type: "affected"; items: S["affected"][number][] }
  | { type: "unknowns"; items: string[] }
  | { type: "glossary" }
  | { type: "context"; context: NonNullable<S["whyNotBefore"]> }
  | { type: "perspectives" }
  | {
      type: "furtherReading";
      deepDive?: NonNullable<S["deepDive"]>;
      reading: NonNullable<S["reading"]>[number][];
    };

/** The visual a set of facts supports, preferring the one requested. */
export function supportedFigureVisual(
  requested: ArticleFigureVisual,
  facts: readonly FigureFact[],
): ArticleFigureVisual {
  if (requested === "scale")
    return getBillScaleFigure(facts) ? "scale" : "metrics";
  if (requested === "timeline")
    return getBillDateMilestones(facts).length ? "timeline" : "metrics";
  return "metrics";
}

function inferredFigureVisual(
  facts: readonly FigureFact[],
): ArticleFigureVisual {
  if (getBillFactFigure(facts)?.kind === "scale") return "scale";
  return getBillDateMilestones(facts).length ? "timeline" : "metrics";
}

const range = (length: number) => Array.from({ length }, (_, index) => index);

/**
 * The layout a pre-v9 brief implies: its fixed reading order, with the visual
 * readers used to infer from fact text recorded on the figure block.
 */
export function inferArticleLayout(source: ArticleSource): ArticleLayout {
  const layout: ArticleLayout = [];
  if (source.changes.length)
    layout.push({
      type: "changes",
      display:
        getBillVisualKind(source.facts) === "changes" ? "map" : "explorer",
      items: range(source.changes.length),
    });
  if (source.facts.length)
    layout.push({
      type: "figure",
      visual: inferredFigureVisual(source.facts),
      facts: range(source.facts.length),
    });
  layout.push(
    { type: "affected" },
    { type: "unknowns" },
    { type: "glossary" },
    { type: "context" },
    { type: "perspectives" },
    { type: "furtherReading" },
  );
  return verifyArticleLayout(layout, source);
}

/**
 * Enforce in code what the writer is asked to do, so a stored layout is always
 * honest about its content:
 *
 *  - references stay in range and each change or fact appears once;
 *  - a visual the facts cannot support is drawn as metrics;
 *  - blocks with nothing to show, and repeated singleton blocks, are dropped;
 *  - every change, fact, affected group and unknown remains on the page —
 *    omitted ones are appended, because hiding a provision (say, one that
 *    removes oversight) by leaving it out of the layout would break the
 *    brief's guarantees as surely as deleting it.
 *
 * Depth blocks (glossary, history, further reading) may be omitted by choice.
 */
export function verifyArticleLayout(
  layout: readonly unknown[],
  source: ArticleSource,
): ArticleLayout {
  const usedChanges = new Set<number>();
  const usedFacts = new Set<number>();
  const seen = new Set<string>();
  const factsAt = (indices: readonly number[]) =>
    indices.flatMap((index) => {
      const fact = source.facts[index];
      return fact ? [fact] : [];
    });
  // Keep the in-range positions no earlier block has claimed.
  const claim = (indices: unknown, length: number, used: Set<number>) => {
    const claimed: number[] = [];
    for (const index of Array.isArray(indices) ? (indices as unknown[]) : []) {
      if (typeof index !== "number" || !Number.isInteger(index)) continue;
      if (index < 0 || index >= length) continue;
      if (used.has(index)) continue;
      used.add(index);
      claimed.push(index);
    }
    return claimed;
  };
  const present: Record<string, boolean> = {
    affected: source.affected.length > 0,
    unknowns: source.unknowns.length > 0,
    glossary: source.terms.length > 0,
    context: Boolean(source.whyNotBefore),
    perspectives: true,
    furtherReading: Boolean(source.deepDive) || Boolean(source.reading?.length),
  };

  const verified: ArticleLayout = [];
  for (const raw of layout) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    if (block.type === "changes") {
      const items = claim(block.items, source.changes.length, usedChanges);
      if (items.length)
        verified.push({
          type: "changes",
          display: block.display === "map" ? "map" : "explorer",
          items,
        });
    } else if (block.type === "figure") {
      const facts = claim(block.facts, source.facts.length, usedFacts);
      if (!facts.length) continue;
      const requested = ArticleFigureVisualSchema.safeParse(block.visual);
      verified.push({
        type: "figure",
        visual: supportedFigureVisual(
          requested.success ? requested.data : "metrics",
          factsAt(facts),
        ),
        facts,
      });
    } else if (
      typeof block.type === "string" &&
      present[block.type] &&
      !seen.has(block.type)
    ) {
      seen.add(block.type);
      verified.push({ type: block.type } as ArticleLayout[number]);
    }
  }

  const unplacedChanges = range(source.changes.length).filter(
    (index) => !usedChanges.has(index),
  );
  if (unplacedChanges.length) {
    const first = verified.find((block) => block.type === "changes");
    if (first?.type === "changes") first.items.push(...unplacedChanges);
    else
      verified.unshift({
        type: "changes",
        display: source.facts.length ? "explorer" : "map",
        items: unplacedChanges,
      });
  }

  const unplacedFacts = range(source.facts.length).filter(
    (index) => !usedFacts.has(index),
  );
  if (unplacedFacts.length) {
    // After the last figure or changes block, where the reader expects it.
    let anchor = -1;
    verified.forEach((block, index) => {
      if (block.type === "figure" || block.type === "changes") anchor = index;
    });
    verified.splice(anchor + 1, 0, {
      type: "figure",
      visual: inferredFigureVisual(factsAt(unplacedFacts)),
      facts: unplacedFacts,
    });
  }

  for (const type of ["affected", "unknowns"] as const) {
    if (present[type] && !seen.has(type)) verified.push({ type });
  }
  return verified;
}

/**
 * Resolve a brief into renderable blocks: its own layout when it has one,
 * otherwise the inferred v8 order. `perspectives` reflects whether the cited
 * dual lens exists for this item; it lives outside the brief, so its block is
 * dropped without one and added before further reading when a layout omits it.
 */
export function resolveArticleBlocks<S extends ArticleSource>(
  source: S,
  options: { perspectives?: boolean } = {},
): ResolvedArticleBlock<S>[] {
  const layout = source.layout
    ? verifyArticleLayout(source.layout, source)
    : inferArticleLayout(source);
  const withLens = layout.filter(
    (block) => block.type !== "perspectives" || options.perspectives,
  );
  if (
    options.perspectives &&
    !withLens.some((block) => block.type === "perspectives")
  ) {
    const further = withLens.findIndex(
      (block) => block.type === "furtherReading",
    );
    withLens.splice(further < 0 ? withLens.length : further, 0, {
      type: "perspectives",
    });
  }

  type Changes = S["changes"][number];
  type Facts = S["facts"][number];
  return withLens.map((block): ResolvedArticleBlock<S> => {
    switch (block.type) {
      case "changes":
        return {
          ...block,
          items: block.items.map((index) => source.changes[index] as Changes),
        };
      case "figure":
        return {
          ...block,
          facts: block.facts.map((index) => source.facts[index] as Facts),
        };
      case "affected":
        return { type: "affected", items: [...source.affected] };
      case "unknowns":
        return { type: "unknowns", items: [...source.unknowns] };
      case "context":
        return {
          type: "context",
          context: source.whyNotBefore as NonNullable<S["whyNotBefore"]>,
        };
      case "furtherReading":
        return {
          type: "furtherReading",
          ...(source.deepDive
            ? { deepDive: source.deepDive as NonNullable<S["deepDive"]> }
            : {}),
          reading: [...(source.reading ?? [])] as NonNullable<
            S["reading"]
          >[number][],
        };
      default:
        return block;
    }
  });
}
