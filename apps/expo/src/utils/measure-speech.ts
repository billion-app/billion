import type { PublicTrillionGraph } from "@acme/validators";

import type { AppLanguage } from "../i18n/language";
import type { RouterOutputs } from "~/utils/api";
import { buildSpeechChunks } from "./speech-script";

export function graphSpeechChunks(
  graph: PublicTrillionGraph,
  language: AppLanguage,
) {
  return buildSpeechChunks({
    title: graph.measure.title,
    language,
    isAIGenerated: true,
    body: [
      graph.summary?.text,
      graph.summary?.more,
      graph.background?.text,
      ...graph.nodes.map((node) =>
        [node.attribution?.name, node.title, node.body, node.note]
          .filter(Boolean)
          .join(". "),
      ),
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}

/** The fallback measure page reads the same explanation the screen displays. */
export function measureSpeechChunks(
  measure: NonNullable<
    RouterOutputs["civic"]["getCaliforniaGuide"]
  >["measures"][number],
  language: AppLanguage,
) {
  const c = measure.consequences;
  const context = measure.contextualExplanation;
  const explanation = c
    ? [
        c.headline.text,
        c.currentRule.text,
        c.yes.text,
        c.no.text,
        ...c.implementation.map((x) => x.text),
        ...c.affected.map((x) => x.text),
        c.costsAndFunding.text,
        c.uncertainty.text,
        c.decisionNote?.text,
      ]
    : [
        measure.officialSummary,
        measure.voteMeaningYes,
        measure.voteMeaningNo,
        measure.fiscalImpact,
      ];
  return buildSpeechChunks({
    title: measure.displayTitle ?? measure.title,
    language,
    isAIGenerated: !!c || !!context,
    body: [
      ...explanation,
      ...(context
        ? [
            context.takeaway.text,
            context.today.text,
            context.change.text,
            context.rationale.text,
            ...context.chain.map((x) => x.action.text),
            ...context.tradeoffs.map((x) => x.text),
            ...context.unknowns.map((x) => x.claim.text),
          ]
        : []),
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}
