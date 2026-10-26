import type { TrillionGraph } from "@acme/validators";
import { plainTrillionText } from "@acme/validators";

const COMPARISON =
  /\b(narrower|weaker|stronger|streamlined|stricter|meaningful|accountability|qualifying|certain)\b/i;
const COVERAGE =
  /\b(high[ -]incomes?|low[ -]incomes?|middle[ -]incomes?|eligible|qualifying|certain|program services)\b/i;

/** Editorial review leads, not a semantic publication gate. */
export function auditTrillionClarity(graph: TrillionGraph) {
  const reference = (node: TrillionGraph["nodes"][number]) => ({
    id: node.id,
    title: plainTrillionText(node.title),
  });
  const mechanisms = new Set(
    graph.nodes
      .filter(
        (node) =>
          ["provision", "analysis"].includes(node.kind) &&
          node.quotes.some((quote) =>
            graph.sources.some(
              (source) =>
                source.id === quote.sourceId &&
                source.number === graph.measure.number &&
                ["legal-text", "official-analysis"].includes(source.role),
            ),
          ),
      )
      .map((node) => node.id),
  );
  return {
    missingSummary: !graph.summary,
    comparisonsWithoutContext: graph.nodes
      .filter((node) => COMPARISON.test(node.title) && !node.body?.trim())
      .map(reference),
    disputesWithoutContext: graph.nodes
      .filter((node) => node.kind === "crux" && !node.body?.trim())
      .map(reference),
    argumentsWithoutMechanism: graph.nodes
      .filter(
        (node) =>
          node.kind === "argument" &&
          !graph.edges.some(
            (edge) =>
              edge.to === node.id &&
              mechanisms.has(edge.from) &&
              ["supports", "challenges", "qualifies"].includes(edge.type) &&
              !!edge.why?.trim(),
          ),
      )
      .map(reference),
    coverageToReview: {
      summary: graph.summary
        ? [graph.summary.text, graph.summary.more ?? ""].filter((text) =>
            COVERAGE.test(text),
          )
        : [],
      cards: graph.nodes
        .filter(
          (node) => node.kind === "provision" && COVERAGE.test(node.title),
        )
        .map(reference),
    },
  };
}
