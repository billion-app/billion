import type { TrillionGraph } from "@acme/validators";
import { trillionDepths } from "@acme/validators";

const RESPONSE = new Set(["challenges", "qualifies", "answers"]);
const STATEMENT = new Set([
  "argument",
  "generated",
  "provision",
  "finding",
  "analysis",
  "precedent",
  "fact",
  "record",
]);

/** Structural exchange paths for editorial comparison; not a reasoning-quality score. */
export function assessTrillionReasoning(graph: TrillionGraph) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, TrillionGraph["edges"]>();
  for (const edge of graph.edges)
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  const disputes = graph.nodes
    .filter((node) => node.kind === "crux")
    .map((crux) => {
      const candidates = (incoming.get(crux.id) ?? []).filter(
        (edge) =>
          edge.type === "weighs" &&
          ["argument", "generated"].includes(nodes.get(edge.from)?.kind ?? ""),
      );
      const claims = [
        ...new Map(candidates.map((edge) => [edge.from, edge])).values(),
      ];
      const exchanges: { claim: string; objection: string; reply: string }[] =
        [];
      const seen = new Set<string>();
      for (const claim of claims)
        for (const objection of incoming.get(claim.from) ?? []) {
          if (
            !["challenges", "qualifies"].includes(objection.type) ||
            !STATEMENT.has(nodes.get(objection.from)?.kind ?? "")
          )
            continue;
          for (const reply of incoming.get(objection.from) ?? []) {
            const ids = [claim.from, objection.from, reply.from];
            const key = ids.join("\0");
            if (
              RESPONSE.has(reply.type) &&
              STATEMENT.has(nodes.get(reply.from)?.kind ?? "") &&
              new Set(ids).size === 3 &&
              !seen.has(key)
            ) {
              seen.add(key);
              exchanges.push({
                claim: claim.from,
                objection: objection.from,
                reply: reply.from,
              });
            }
          }
        }
      return { id: crux.id, mainArguments: claims.length, exchanges };
    });
  return {
    navigationDepth: Math.max(0, ...trillionDepths(graph).values()),
    disputesWithExchanges: disputes.filter((crux) => crux.exchanges.length > 0)
      .length,
    disputes,
  };
}
