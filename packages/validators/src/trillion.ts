import { z } from "zod/v4";

import {
  contextMoneyMentions,
  contextMoneySchema,
  hasUncoveredContextMoney,
  nominalMoneyBounds,
} from "./budget-context";

/**
 * The Trillion: a reviewed argument graph for one ballot measure (#455).
 *
 * The root is the reader's own question. Orientation branches and the
 * disputed questions hang off it; arguments sit under a disputed question with
 * their lean toward the vote as a stance, never in pro/con columns. Every
 * source-backed node quotes captured official text verbatim.
 *
 * Graphs publish without a human review step. In place of review, publication
 * is gated by machine checks: this schema, verbatim quote verification, and
 * source freshness at read time. Reads never generate.
 */

const id = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(80);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const measureNumber = z.string().regex(/^\d+[A-Z]?$/);
const officialUrl = z
  .url()
  .regex(
    /^https:\/\/(?:voterguide\.sos\.ca\.gov|vig\.cdn\.sos\.ca\.gov)\/[^\s@]*$/,
    "Trillion sources must be official California guide documents.",
  );

/**
 * Historical context comes from official PDFs and LAO publication reports.
 * PDFs use document-byte freshness; LAO HTML uses the captured article text.
 */
export const TRILLION_PRECEDENT_HOSTS = [
  "information.auditor.ca.gov",
  "www.lao.ca.gov",
  "lao.ca.gov",
  "vigarchive.sos.ca.gov",
] as const;
const precedentUrl =
  /^https:\/\/(?:(?:information\.auditor\.ca\.gov|(?:www\.)?lao\.ca\.gov|vigarchive\.sos\.ca\.gov)\/[^\s@?#]*\.pdf|(?:www\.)?lao\.ca\.gov\/Publications\/Report\/\d+)$/;

export const TRILLION_NODE_KINDS = [
  "root",
  "branch",
  "crux",
  "provision",
  "finding",
  "analysis",
  "argument",
  "generated",
  "question",
  "shared",
  "record",
  "fact",
  "precedent",
] as const;
/** Nodes that speak for a source and therefore must quote it. */
export const QUOTED_TRILLION_KINDS = new Set<string>([
  "provision",
  "finding",
  "analysis",
  "argument",
  "record",
  "precedent",
  "fact",
]);
export const TRILLION_EDGE_TYPES = [
  "part",
  "detail",
  "crux",
  "weighs",
  "supports",
  "challenges",
  "qualifies",
  "appliesTo",
  "asks",
  "answers",
  "conflicts",
] as const;

export const trillionSourceSchema = z
  .object({
    id,
    /** The measure the source belongs to; for precedent, the measure it informs. */
    number: measureNumber,
    role: z.enum([
      "legal-text",
      "official-analysis",
      "official-arguments",
      "precedent",
    ]),
    url: z.url(),
    /** Precedent documents name themselves, e.g. "State Auditor, Report 2017-117 (2018)". */
    title: z.string().trim().min(1).max(200).optional(),
    locator: z.string().trim().min(1).max(300),
    retrievedAt: z.iso.datetime(),
    snapshot: z.string().min(1).max(400_000),
    hash,
    documentHash: hash,
  })
  .superRefine((source, ctx) => {
    const precedent = source.role === "precedent";
    if (
      precedent
        ? !precedentUrl.test(source.url)
        : !officialUrl.safeParse(source.url).success
    )
      ctx.addIssue({
        code: "custom",
        message: precedent
          ? "Precedent sources must be official PDFs or LAO publication reports."
          : "Trillion sources must be official California guide documents.",
      });
    if (precedent !== (source.title !== undefined))
      ctx.addIssue({
        code: "custom",
        message: "Precedent sources, and only they, carry a title.",
      });
  });

export const trillionQuoteSchema = z.object({
  sourceId: id,
  locator: z.string().trim().min(1).max(200),
  /** Verbatim source text. "…" marks an omission between verbatim segments. */
  text: z.string().trim().min(12).max(1500),
});

/**
 * Jargon a voter may not know ("spending limit"), defined in one everyday
 * sentence. Like the bill briefs' terms, readers see the term in blue and tap
 * it for the meaning. Definitions are Billion's explanation, not quotes.
 */
export const trillionTermSchema = z.object({
  term: z.string().trim().min(2).max(60),
  plain: z.string().trim().min(10).max(250),
});

/** An editorial selection, with the actual evidence a reader can inspect. */
export const trillionHighlightSchema = z.object({
  rank: z.number().int().min(1).max(3),
  reason: z.string().trim().min(20).max(300),
  evidence: z.array(id).min(1).max(6),
});

export const trillionContextSchema = z.object({
  topic: z.enum(["baseline", "history", "budget"]),
  period: z.string().trim().min(1).max(120),
  scope: z.string().trim().min(1).max(200),
  /** Limits of the evidence, including whether an earlier program is comparable. */
  limitation: z.string().trim().min(20).max(400),
  money: z.array(contextMoneySchema).max(6).default([]),
});

export const trillionNodeSchema = z.object({
  id,
  kind: z.enum(TRILLION_NODE_KINDS),
  /** A few words for the map card; the full statement lives in `title`. */
  label: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(800).optional(),
  quotes: z.array(trillionQuoteSchema).max(4).default([]),
  attribution: z
    .object({
      name: z.string().trim().min(1).max(200),
      signers: z.string().trim().min(1).max(600).optional(),
    })
    .optional(),
  /** Disputed questions name the kind of disagreement. */
  dispute: z.enum(["facts", "values", "reading", "legal"]).optional(),
  highlight: trillionHighlightSchema.optional(),
  context: trillionContextSchema.optional(),
  /** Other ballot measures referenced by a `record` node. */
  record: z.object({ number: measureNumber }).optional(),
  note: z.string().trim().min(1).max(400).optional(),
});

export const trillionEdgeSchema = z.object({
  id,
  from: id,
  to: id,
  type: z.enum(TRILLION_EDGE_TYPES),
  /** Lean toward the vote, required on `weighs` and nowhere else. */
  stance: z.enum(["for", "against", "mixed"]).optional(),
  why: z.string().trim().min(1).max(400).optional(),
});

const graphShape = z.object({
  schemaVersion: z.literal(1),
  revision: id,
  jurisdiction: z.literal("CA"),
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  measure: z.object({
    number: measureNumber,
    title: z.string().min(1).max(2000),
    url: officialUrl,
    guideHash: hash,
  }),
  rootId: id,
  terms: z.array(trillionTermSchema).max(12).default([]),
  /**
   * What the measure does, in two or three plain sentences under the reader's
   * question. Billion writes it, so it must quote the measure's own legal text
   * for every point; the official summary is not used, because it can mislead.
   */
  summary: z
    .object({
      /** One short sentence: the core change. */
      text: z.string().trim().min(15).max(140),
      /** Optional detail behind "Read more": who it covers, where money goes. */
      more: z.string().trim().min(20).max(400).optional(),
      quotes: z.array(trillionQuoteSchema).min(1).max(6),
      /** Drafted in its own model call that saw only the legal text. */
      generation: z
        .object({
          promptVersion: z.string().min(1).max(100),
          model: z.string().min(1).max(200),
          generatedAt: z.iso.datetime(),
        })
        .optional(),
    })
    .optional(),
  /**
   * How things work today, for a reader new to state government: a few plain
   * sentences drawn only from the official analysis's Background section, so
   * the change in the summary has something to change from.
   */
  background: z
    .object({
      text: z.string().trim().min(20).max(360),
      quotes: z.array(trillionQuoteSchema).min(1).max(4),
    })
    .optional(),
  nodes: z.array(trillionNodeSchema).min(5).max(150),
  edges: z.array(trillionEdgeSchema).max(500),
  sources: z.array(trillionSourceSchema).min(1).max(12),
  /**
   * Graphs publish unverified, and readers see an "AI-generated" disclaimer on
   * everything Billion wrote itself. When a person later verifies a revision
   * (once accounts and roles exist), the disclaimer is removed. Verification
   * names the exact revision, so a regenerated graph starts unverified again.
   */
  verification: z
    .discriminatedUnion("state", [
      z.object({ state: z.literal("unverified") }),
      z.object({
        state: z.literal("verified"),
        by: z.string().trim().min(1).max(200),
        at: z.iso.datetime(),
        revision: id,
      }),
    ])
    .default({ state: "unverified" }),
  /** Provenance; every graph is AI-assisted and labeled as such to readers. */
  generation: z.object({
    promptVersion: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    inputHash: hash,
    generatedAt: z.iso.datetime(),
  }),
});

/**
 * Emphasis follows the bill briefs: Billion's own prose may wrap one or two
 * short key phrases in `**`, never a whole statement. Labels and verbatim
 * quotes carry none.
 */
export function trillionEmphasis(
  text: string,
): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
export const plainTrillionText = (text: string) => text.replaceAll("**", "");
function emphasisProblem(text: string): string | undefined {
  const marks = text.split("**").length - 1;
  if (marks === 0) return undefined;
  if (marks % 2 !== 0) return "unbalanced ** markers";
  const spans = trillionEmphasis(text).filter((part) => part.bold);
  if (spans.length > 2) return "more than two bold phrases";
  if (
    spans.some(
      (span) => span.text.trim() !== span.text || span.text.length > 60,
    )
  )
    return "bold phrases must be short and trimmed";
  if (
    spans.some(
      (span) => span.text.length >= plainTrillionText(text).length * 0.8,
    )
  )
    return "bold marks a key phrase, not the whole statement";
  return undefined;
}

/**
 * How far a card may sit from the main case, counting links either way. A
 * debate can always go one level deeper (a response to a response to a
 * response…); past this point the reader is lost, so graphs stop here.
 * Generation seeds stay one level shallower, leaving room for readers.
 */
export const TRILLION_MAX_DEPTH = 5;
export const TRILLION_SEED_MAX_DEPTH = 4;

/** Steps from the root to each node, following links in either direction. */
export function trillionDepths(graph: {
  rootId: string;
  edges: { from: string; to: string }[];
}): Map<string, number> {
  const next = new Map<string, string[]>();
  for (const e of graph.edges) {
    next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
    next.set(e.to, [...(next.get(e.to) ?? []), e.from]);
  }
  const depth = new Map([[graph.rootId, 0]]);
  const queue = [graph.rootId];
  // Iterating the queue picks up nodes appended during the walk.
  for (const at of queue) {
    for (const n of next.get(at) ?? [])
      if (!depth.has(n)) {
        depth.set(n, (depth.get(at) ?? 0) + 1);
        queue.push(n);
      }
  }
  return depth;
}

/**
 * Billion's own claims ("generated") may not stand on assertion: each must
 * rest, directly or through other cards, on a card that quotes a source.
 * Questions ask and shared framework claims name assumptions, so they are
 * exempt.
 */
export function ungroundedTrillionClaims(graph: {
  nodes: { id: string; kind: string }[];
  edges: { from: string; to: string; type: string }[];
}): string[] {
  const kind = new Map(graph.nodes.map((n) => [n.id, n.kind]));
  const grounded = new Set(
    graph.nodes
      .filter((n) => QUOTED_TRILLION_KINDS.has(n.kind))
      .map((n) => n.id),
  );
  // Grow the grounded set through "supports" and "qualifies" until it stops changing.
  for (let changed = true; changed; ) {
    changed = false;
    for (const e of graph.edges)
      if (
        (e.type === "supports" || e.type === "qualifies") &&
        grounded.has(e.from) &&
        !grounded.has(e.to) &&
        kind.get(e.to) === "generated"
      ) {
        grounded.add(e.to);
        changed = true;
      }
  }
  return graph.nodes
    .filter((n) => n.kind === "generated" && !grounded.has(n.id))
    .map((n) => n.id);
}

/** Structural rules shared by the full record and its public projection. */
function checkStructure(
  value: Pick<
    z.infer<typeof graphShape>,
    | "rootId"
    | "nodes"
    | "edges"
    | "measure"
    | "revision"
    | "verification"
    | "summary"
    | "background"
    | "terms"
  > & { sources: { id: string; number: string; role: string }[] },
  ctx: z.RefinementCtx,
) {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const nodes = new Map(value.nodes.map((node) => [node.id, node]));
  if (nodes.size !== value.nodes.length) issue("Node ids must be unique.");
  if (new Set(value.edges.map((edge) => edge.id)).size !== value.edges.length)
    issue("Edge ids must be unique.");
  if (new Set(value.sources.map((s) => s.id)).size !== value.sources.length)
    issue("Source ids must be unique.");
  const roots = value.nodes.filter((node) => node.kind === "root");
  if (roots.length !== 1 || roots[0]?.id !== value.rootId)
    issue("Exactly one root node, matching rootId, is required.");
  const sourceIds = new Set(value.sources.map((s) => s.id));
  const precedentSources = new Set(
    value.sources.filter((s) => s.role === "precedent").map((s) => s.id),
  );

  const termKeys = value.terms.map((t) => t.term.toLowerCase());
  if (new Set(termKeys).size !== termKeys.length)
    issue("Each term is defined once.");
  for (const t of value.terms) {
    if (contextMoneyMentions(t.plain).length > 0)
      issue(`term "${t.term}": definitions may not state monetary amounts.`);
    if (t.term.includes("**") || emphasisProblem(t.plain))
      issue(
        `term "${t.term}": emphasis only marks a short phrase of the definition.`,
      );
  }

  if (value.summary) {
    for (const text of [value.summary.text, value.summary.more ?? ""]) {
      const problem = emphasisProblem(text);
      if (problem) issue(`summary has ${problem}.`);
    }
    for (const quote of value.summary.quotes) {
      const source = value.sources.find((s) => s.id === quote.sourceId);
      // The summary describes this measure, so only its own legal text counts.
      if (
        source?.role !== "legal-text" ||
        source.number !== value.measure.number
      )
        issue("summary must quote this measure's own legal text.");
      if (quote.text.includes("**"))
        issue("labels and verbatim quotes carry no emphasis.");
    }
  }

  if (value.background) {
    const problem = emphasisProblem(value.background.text);
    if (problem) issue(`background has ${problem}.`);
    for (const quote of value.background.quotes) {
      const source = value.sources.find((s) => s.id === quote.sourceId);
      // Background is the nonpartisan account of today, not the measure.
      if (
        source?.role !== "official-analysis" ||
        source.number !== value.measure.number
      )
        issue("background must quote this measure's official analysis.");
      if (quote.text.includes("**"))
        issue("background: verbatim quotes carry no emphasis.");
    }
  }

  for (const node of value.nodes) {
    if (node.highlight) {
      if (node.kind !== "crux")
        issue(`${node.id}: only disputed questions can be highlighted.`);
      if (contextMoneyMentions(node.highlight.reason).length)
        issue(`${node.id}: highlight reasons may not state monetary amounts.`);
      for (const evidence of node.highlight.evidence) {
        const cited = nodes.get(evidence);
        if (
          !cited?.quotes.length ||
          !value.edges.some(
            (e) =>
              e.from === evidence && e.to === node.id && e.type === "weighs",
          )
        )
          issue(
            `${node.id}: highlighted questions must link to quoted evidence weighing on this question.`,
          );
      }
    }
    if (node.context) {
      const context = node.context;
      if (
        !["analysis", "precedent", "fact"].includes(node.kind) ||
        !node.quotes.length
      )
        issue(
          `${node.id}: context must be a quoted analysis, historical record, or fact.`,
        );
      if (
        node.quotes.some(
          (q) =>
            !value.sources.some(
              (s) =>
                s.id === q.sourceId &&
                ["official-analysis", "precedent"].includes(s.role),
            ),
        )
      )
        issue(
          `${node.id}: context must cite nonpartisan analysis or historical records, not campaign claims.`,
        );
      if (
        !value.edges.some(
          (e) =>
            e.from === node.id && e.to === "b-before" && e.type === "detail",
        )
      )
        issue(`${node.id}: context belongs under What was it like before?.`);
      if (
        hasUncoveredContextMoney(
          [
            node.label,
            node.title,
            node.body ?? "",
            node.note ?? "",
            context.period,
            context.scope,
            context.limitation,
          ].join(" "),
          context.money,
        )
      )
        issue(
          `${node.id}: every context amount needs matching budget context.`,
        );
      for (const money of context.money) {
        if (
          !node.quotes.some((q) =>
            contextMoneyMentions(q.text).some(
              (amount) =>
                normalizeQuoteText(amount) ===
                normalizeQuoteText(money.nominal),
            ),
          )
        )
          issue(
            `${node.id}: context amounts must appear in the card's source quotations.`,
          );
        if (money.comparison.state === "available") {
          const denominator = money.comparison.denominator;
          for (const evidence of denominator.evidence)
            if (
              !node.quotes.some(
                (q) =>
                  q.sourceId === evidence.sourceId &&
                  q.locator === evidence.locator &&
                  contextMoneyMentions(q.text).some((amount) => {
                    const bounds = nominalMoneyBounds(amount);
                    return (
                      bounds?.min === denominator.amount &&
                      bounds.max === denominator.amount
                    );
                  }),
              )
            )
              issue(
                `${node.id}: budget denominators need a source quotation at the cited locator.`,
              );
        }
      }
    }
    if (QUOTED_TRILLION_KINDS.has(node.kind) && node.quotes.length === 0)
      issue(`${node.id}: source-backed nodes must quote their source.`);
    for (const quote of node.quotes) {
      if (!sourceIds.has(quote.sourceId))
        issue(`${node.id}: quote cites unknown source ${quote.sourceId}.`);
      // A past document must never read as this measure's text, and vice versa.
      if ((node.kind === "precedent") !== precedentSources.has(quote.sourceId))
        issue(
          `${node.id}: precedent nodes, and only they, quote precedent sources.`,
        );
    }
    for (const [field, text] of [
      ["title", node.title],
      ["body", node.body ?? ""],
    ] as const) {
      const problem = emphasisProblem(text);
      if (problem) issue(`${node.id}: ${field} has ${problem}.`);
    }
    if (
      node.label.includes("**") ||
      node.quotes.some((quote) => quote.text.includes("**"))
    )
      issue(`${node.id}: labels and verbatim quotes carry no emphasis.`);
    if (node.kind === "argument" && !node.attribution)
      issue(`${node.id}: arguments keep their published attribution.`);
    if ((node.kind === "crux") !== (node.dispute !== undefined))
      issue(`${node.id}: disputed questions, and only they, name a dispute.`);
    if ((node.kind === "record") !== (node.record !== undefined))
      issue(`${node.id}: record nodes, and only they, name a measure.`);
    if (node.record?.number === value.measure.number)
      issue(`${node.id}: a record node must name a different measure.`);
    // Billion's own words carry no amounts; amounts stay inside quoted sources.
    if (
      node.quotes.length === 0 &&
      [node.label, node.title, node.body ?? ""].some(
        (text) => contextMoneyMentions(text).length > 0,
      )
    )
      issue(`${node.id}: unquoted nodes may not state monetary amounts.`);
  }

  for (const edge of value.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) {
      issue(`${edge.id}: edge endpoints must exist.`);
      continue;
    }
    if (edge.from === edge.to) issue(`${edge.id}: no self-links.`);
    if ((edge.type === "weighs") !== (edge.stance !== undefined))
      issue(`${edge.id}: stance is required on weighs links and only there.`);
    if (edge.type === "weighs" && to.kind !== "crux")
      issue(`${edge.id}: arguments weigh in under a disputed question.`);
    if (
      edge.type === "detail" &&
      to.id === "b-before" &&
      !from.context &&
      from.kind !== "question"
    )
      issue(
        `${edge.id}: background entries need scoped context or an unanswered question.`,
      );
    if (
      edge.type === "crux" &&
      (from.kind !== "crux" || to.id !== value.rootId)
    )
      issue(`${edge.id}: disputed questions hang off the root.`);
    if (
      edge.type === "part" &&
      (from.kind !== "branch" || to.id !== value.rootId)
    )
      issue(`${edge.id}: orientation branches hang off the root.`);
    if (edge.why && contextMoneyMentions(edge.why).length > 0)
      issue(`${edge.id}: link explanations may not state monetary amounts.`);
  }
  for (const [nodeId, d] of trillionDepths(value))
    if (d > TRILLION_MAX_DEPTH)
      issue(
        `${nodeId}: more than ${TRILLION_MAX_DEPTH} steps from the main case.`,
      );
  for (const nodeId of ungroundedTrillionClaims(value))
    issue(`${nodeId}: Billion's claims must rest on a quoted source.`);
  const branches = value.nodes.filter((node) => node.kind === "branch");
  const ranks = value.nodes.flatMap((n) =>
    n.highlight ? [n.highlight.rank] : [],
  );
  if (new Set(ranks).size !== ranks.length)
    issue("Highlight ranks must be unique.");
  if (
    !(
      branches.length === 4 ||
      (branches.length === 5 && branches.some((n) => n.id === "b-before"))
    ) ||
    !branches.every((branch) =>
      value.edges.some((e) => e.type === "part" && e.from === branch.id),
    )
  )
    issue(
      "The root needs four orientation branches, optionally with What was it like before?.",
    );
  if (
    value.verification.state === "verified" &&
    value.verification.revision !== value.revision
  )
    issue("Verification must name this exact revision.");
  if (!value.nodes.some((node) => node.kind === "crux"))
    issue("At least one disputed question is required.");
  for (const node of value.nodes)
    if (
      node.id !== value.rootId &&
      !value.edges.some((e) => e.from === node.id || e.to === node.id)
    )
      issue(`${node.id}: every node must connect to the graph.`);
}

export const trillionGraphSchema = graphShape.superRefine(checkStructure);
export type TrillionGraph = z.infer<typeof trillionGraphSchema>;
export type TrillionNode = z.infer<typeof trillionNodeSchema>;
export type TrillionEdge = z.infer<typeof trillionEdgeSchema>;
export type TrillionSource = z.infer<typeof trillionSourceSchema>;

const publicTrillionSourceSchema = z.object({
  id,
  number: measureNumber,
  role: z.enum([
    "legal-text",
    "official-analysis",
    "official-arguments",
    "precedent",
  ]),
  url: z.url(),
  title: z.string().trim().min(1).max(200).optional(),
  locator: z.string().trim().min(1).max(300),
  retrievedAt: z.iso.datetime(),
  hash,
  documentHash: hash,
});

/** What clients receive: source snapshots stay on the server. */
export const publicTrillionGraphSchema = graphShape
  .omit({ sources: true })
  .extend({
    sources: z.array(publicTrillionSourceSchema).min(1).max(12),
  })
  .superRefine(checkStructure);
export type PublicTrillionGraph = z.infer<typeof publicTrillionGraphSchema>;

/**
 * Rebuild reading order from `pdftotext -layout` output. Official guide pages
 * set the law in two columns, so a sentence otherwise interleaves with its
 * neighbor. Pages with a consistent second-column start are split at it.
 */
export function readingOrderText(snapshot: string): string {
  return snapshot
    .split("\f")
    .map((page) => {
      const lines = page.split("\n");
      const starts = new Map<number, number>();
      for (const line of lines) {
        const match = /\S\s{3,}(\S)/.exec(line);
        if (match && match.index > 30) {
          const start = match.index + match[0].length - 1;
          starts.set(start, (starts.get(start) ?? 0) + 1);
        }
      }
      const best = [...starts].sort((a, b) => b[1] - a[1])[0];
      if (!best || best[1] < 5) return page;
      const column = best[0];
      return [
        ...lines.map((line) => line.slice(0, column)),
        ...lines.map((line) => line.slice(column)),
      ].join("\n");
    })
    .join("\n");
}

/** Comparison form: typography, hyphenation and line breaks don't change meaning. */
export function normalizeQuoteText(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[-‐‑–—]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Every verbatim segment must appear, in order, in the cited source. */
export function quoteAppearsIn(sourceText: string, quote: string): boolean {
  const haystack = normalizeQuoteText(readingOrderText(sourceText));
  const segments = quote
    .split("…")
    .map((segment) => normalizeQuoteText(segment))
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return false;
  let at = 0;
  for (const segment of segments) {
    if (segment.length < 8) return false;
    const found = haystack.indexOf(segment, at);
    if (found < 0) return false;
    at = found + segment.length;
  }
  return true;
}

/** Quotes that do not appear verbatim in their captured source. */
export function unverifiedTrillionQuotes(graph: TrillionGraph): string[] {
  const sources = new Map(graph.sources.map((s) => [s.id, s]));
  const failures: string[] = [];
  for (const node of graph.nodes)
    node.quotes.forEach((quote, index) => {
      const source = sources.get(quote.sourceId);
      if (!source || !quoteAppearsIn(source.snapshot, quote.text))
        failures.push(`${node.id}#${index}`);
    });
  graph.summary?.quotes.forEach((quote, index) => {
    const source = sources.get(quote.sourceId);
    if (!source || !quoteAppearsIn(source.snapshot, quote.text))
      failures.push(`summary#${index}`);
  });
  graph.background?.quotes.forEach((quote, index) => {
    const source = sources.get(quote.sourceId);
    if (!source || !quoteAppearsIn(source.snapshot, quote.text))
      failures.push(`background#${index}`);
  });
  return failures;
}

export function publicTrillionGraph(graph: TrillionGraph): PublicTrillionGraph {
  return {
    ...graph,
    sources: graph.sources.map(({ snapshot: _snapshot, ...source }) => source),
  };
}
