import { z } from "zod/v4";

import type { TrillionGraph } from "@acme/validators";
import { trillionDepths } from "@acme/validators";

export const trillionArgumentDepthSchema = z.enum(["standard", "deep"]);
export type TrillionArgumentDepth = z.infer<typeof trillionArgumentDepthSchema>;

export const TRILLION_DEEP_INSTRUCTIONS = `Build reasoning a reader can follow beyond the first claim:
- For at least three disputes where the sources permit it, build an argument → specific objection or qualification → reply. Explain the causal premise, why the objection matters, and what the reply does or does not establish. Use separate cards for distinct claims rather than hiding the whole exchange in one long body.
- Only the main arguments weigh directly on a crux. Attach objections to the particular claim or premise they challenge with "challenges" or "qualifies", and attach replies to those objections with "challenges", "qualifies" or "answers" as appropriate. Do not also attach every nested response directly to the crux merely to increase its argument count.
- A published rebuttal is an attributed "argument" only when its quotation actually makes that response. Your own reconstruction of a causal step, limitation or reply is "generated", explicitly conditional, and grounded by incoming "supports" or "qualifies" links from quoted evidence. A quotation is not proof of a connection you invented.
- Prefer the strongest source-supported objection to a concrete premise over generic claims that the proposal is good, bad, expensive or risky. Separate a challenge to a factual prediction from a disagreement about values. Explain the assumption on which a reply depends.
- Reuse existing provision, analysis and precedent cards as evidence. A reply may concede part of an objection; it must not imply that the dispute is settled. If the sources cannot answer an objection, attach a specific unanswered question instead of manufacturing a rebuttal or a balanced pair.
- Keep the same four-to-six dispute overview. Aim for 60–80 focused cards, using added cards for premises and exchanges rather than more top-level claims. Keep map labels below 60 characters, quotes at most four per card, and every card within four steps of the main case; leave the fifth level for readers.
- In staged planning, put each nested response in its dispute's home group, leave its "weighsOn" empty unless it independently introduces a main argument, and name its exact target card id and relationship in "intent" so the expansion can wire the exchange.`;

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
