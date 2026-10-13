import { z } from "zod/v4";

import { contextMoneyMentions } from "./budget-context";

/**
 * The Trillion: a reviewed argument graph for one ballot measure (#455).
 *
 * The root is the reader's own question. Four orientation branches and the
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
 * Historical precedent comes from archived official PDFs: the State Auditor,
 * the Legislative Analyst, and past voter guides. PDFs only, so freshness can
 * compare document bytes.
 */
export const TRILLION_PRECEDENT_HOSTS = [
  "information.auditor.ca.gov",
  "www.lao.ca.gov",
  "lao.ca.gov",
  "vigarchive.sos.ca.gov",
] as const;
const precedentUrl =
  /^https:\/\/(?:information\.auditor\.ca\.gov|(?:www\.)?lao\.ca\.gov|vigarchive\.sos\.ca\.gov)\/[^\s@?#]*\.pdf$/;

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
          ? "Precedent sources must be archived official PDFs (State Auditor, LAO, or past guides)."
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

/** Structural rules shared by the full record and its public projection. */
function checkStructure(
  value: Pick<
    z.infer<typeof graphShape>,
    "rootId" | "nodes" | "edges" | "measure" | "revision" | "verification"
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

  for (const node of value.nodes) {
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
  const branches = value.nodes.filter((node) => node.kind === "branch");
  if (
    branches.length !== 4 ||
    !branches.every((branch) =>
      value.edges.some((e) => e.type === "part" && e.from === branch.id),
    )
  )
    issue("The root needs exactly the four orientation branches.");
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
  return failures;
}

export function publicTrillionGraph(graph: TrillionGraph): PublicTrillionGraph {
  return {
    ...graph,
    sources: graph.sources.map(({ snapshot: _snapshot, ...source }) => source),
  };
}
