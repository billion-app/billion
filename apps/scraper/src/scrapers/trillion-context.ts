import type { TrillionEdge, TrillionNode } from "@acme/validators";

/** Shared by the single-call and staged generators so editorial policy agrees. */
export const TRILLION_CONTEXT_INSTRUCTIONS = `
Decision context and highlighted questions:
- Add the fifth orientation branch, id "b-before", title/label "What was it like before?". It is background evidence, not an argument for either vote. Use source-backed cards with "detail" links to it; in the staged plan their home is "before".
- Give readers the current rules and existing programs (baseline), relevant past results and their limits (history), and where existing money comes from and goes (budget). Use this measure's official analysis and supplied historical records. Campaign claims belong in the debate, never as established background facts. If a topic is not established by the supplied sources, leave it unanswered; never invent a history or a budget breakdown.
- Context cards are kind "analysis" or "fact" for this measure's official analysis, or "precedent" for a historical source. Each has context {topic: "baseline"|"history"|"budget", period, scope, limitation, money: []}. Period names the actual years covered; scope names the program, jurisdiction and fund. Limitation explains what the evidence does NOT establish and, for history, how the earlier program is similar to and different from this proposal. Keep limitations visible, including on favorable evidence. Attach these cards to the disputes they bear on with "weighs" links; use "mixed" when they don't favor a vote by themselves.
- For funding proposals, examine delivery and oversight as well as unmet need: actual outcomes, unspent or committed funds, identified inefficiencies, feasible savings or reallocations, and this proposal's safeguards. Waste does not by itself prove sufficient recoverable savings; unmet need does not prove this proposal works. Do not equate expired borrowing authority with cash wasted, or spending with outcomes. Distinguish measured results, estimates, and campaign predictions.
- For rebate claims, explain the specific rebate mechanism and documented occasions within the source's time window. Separate constitutionally triggered rebates, ordinary overpayment refunds and discretionary relief. Never infer a complete frequency or "never" from a few examples, and never present a historical projection as an event that happened.
- Budget context explains existing spending categories and funding restrictions, not just the proposal's price. Preserve source percentages and their denominator, year and qualifications. Do not manufacture a complete breakdown from partial categories or compare General Fund spending with all-funds revenue.
- Every monetary amount in a context card's title/body/note must have a matching context.money entry and appear verbatim in its quotes. Use the shared shape {nominal, currency:"USD", scope:{period,jurisdiction,timing:"annual"|"one-time"|"stock",accounting:"gross"|"net"|"unspecified"}, comparison:{state:"unavailable"|"inapplicable",reason}} when no matched denominator is supported. An available comparison instead has state:"available", numerator:{min,max}, denominator:{name,amount,currency:"USD",scope,evidence:[{sourceId,locator}]}, basis:"measured"|"projection"|"illustrative". Numeric bounds must agree with nominal. Period, jurisdiction, timing and accounting must match exactly. Quote the denominator at its cited locator too. Never divide multi-year bond totals or reserve stocks by one annual budget. A missing comparison is better than a misleading one.
- Select up to three DISTINCT consequential cruxes with highlight {rank:1|2|3, reason, evidence:[card ids]}. Rank by what could materially change the decision about this proposal, not source order, rhetorical intensity, number of arguments, or assumed voter ideology. Consider effectiveness and feasible alternatives, fiscal tradeoffs, distribution and values, and legal operation; select the concerns actually relevant here, not one from every category. Historical performance is eligible for first place. Do not require equally strong evidence for both sides or manufacture balance.
- Each highlight reason is a short, neutral explanation of the decision that turns on the question (no amounts or voting recommendation), grounded in the linked evidence cards. Evidence ids must name quoted cards with weighs links to that crux. A campaign clash alone is not a reason to prioritize it. Make uncertainty explicit; don't promote a broad claim about government into a fact about this program. The reader labels these as Billion AI selections, not objective rankings.
`;

const GAPS = {
  baseline: [
    "How do the existing rules and programs work?",
    "This record does not yet include a source-backed account of the existing rules and programs.",
  ],
  history: [
    "What happened when similar policies were used before?",
    "A source-backed account of comparable past results is not available here. This does not mean there is no historical evidence.",
  ],
  budget: [
    "Where does the existing money go?",
    "A sourced breakdown of the relevant existing budget is not available here. Spending, unspent balances and recoverable savings are different questions.",
  ],
} as const;

/** Missing evidence stays visible even when validation removed a drafted card. */
export function withContextGaps(
  nodes: TrillionNode[],
  edges: TrillionEdge[],
  rootId: string,
) {
  nodes = [...nodes];
  edges = [...edges];
  if (!nodes.some((n) => n.id === "b-before")) {
    nodes.push({
      id: "b-before",
      kind: "branch",
      label: "What was it like before?",
      title: "What was it like before?",
      body: "Existing rules, past results and money in context. Each record keeps its date, scope and limits.",
      quotes: [],
    });
    edges.push({
      id: "part-before",
      from: "b-before",
      to: rootId,
      type: "part",
    });
  }
  for (const [topic, [title, body]] of Object.entries(GAPS)) {
    const gapId = `context-gap-${topic}`;
    const covered = nodes.some(
      (n) =>
        n.context?.topic === topic &&
        edges.some(
          (e) => e.from === n.id && e.to === "b-before" && e.type === "detail",
        ),
    );
    nodes = nodes.filter((n) => n.id !== gapId);
    edges = edges.filter((e) => e.from !== gapId && e.to !== gapId);
    if (!covered) {
      nodes.push({
        id: gapId,
        kind: "question",
        label: title,
        title,
        body,
        quotes: [],
      });
      edges.push({
        id: `detail-${gapId}`,
        from: gapId,
        to: "b-before",
        type: "detail",
      });
      edges.push({
        id: `asks-${gapId}`,
        from: gapId,
        to: "b-before",
        type: "asks",
      });
    }
  }
  return { nodes, edges };
}
