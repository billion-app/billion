import { createHash } from "node:crypto";

import { contextMoneySchema } from "@acme/validators";

import { collectSegments } from "./content-translation";

// Display copies only. Legal text, quotations, attribution, links and publication
// metadata are always taken from the original record, never model output.
export const MEASURE_FIELDS = [
  "title",
  "displayTitle",
  "officialSummary",
  "voteMeaningYes",
  "voteMeaningNo",
  "fiscalImpact",
  "consequences.headline.text",
  "consequences.currentRule.text",
  "consequences.yes.text",
  "consequences.no.text",
  "consequences.decisionNote.text",
  "consequences.decisionMap.today.text",
  "consequences.decisionMap.yes.text",
  "consequences.decisionMap.no.text",
  "consequences.implementation.*.text",
  "consequences.affected.*.text",
  "consequences.costsAndFunding.text",
  "consequences.uncertainty.text",
  "contextualExplanation.takeaway.text",
  "contextualExplanation.today.text",
  "contextualExplanation.change.text",
  "contextualExplanation.rationale.text",
  "contextualExplanation.terms.*.term",
  "contextualExplanation.terms.*.meaning.text",
  "contextualExplanation.mechanismQuestion",
  "contextualExplanation.chain.*.actor",
  "contextualExplanation.chain.*.action.text",
  "contextualExplanation.tradeoffs.*.text",
  "contextualExplanation.unknowns.*.claim.text",
  "contextualExplanation.magnitude.*.amount.text",
  "contextualExplanation.magnitude.*.period",
  "contextualExplanation.review.findings",
  "contextualExplanation.magnitude.*.comparison.text",
  "contextualExplanation.history.*.finding.text",
  "contextualExplanation.history.*.followThrough.text",
  "contextualExplanation.history.*.outcome.text",
  "contextualExplanation.history.*.limit.text",
  "contextualExplanation.scenarios.*.title",
  "contextualExplanation.scenarios.*.claim.text",
  "contextualExplanation.questions.*.question",
  "contextualExplanation.questions.*.path.text",
  ...[
    "takeaway",
    "affectedProvisions.*",
    "conditions.*",
    ...["neither", "onlyFirst", "onlySecond", "both"].flatMap((scenario) => [
      `scenarios.${scenario}`,
      `compact.scenarios.${scenario}.title`,
      `compact.scenarios.${scenario}.consequence`,
    ]),
    "compact.measures.*",
    "compact.takeaway",
    "compact.provisions.*",
    "compact.conflictScopes.condition",
    "compact.conflictScopes.scopes.*",
    ...["firstMore", "secondMore", "equal"].map(
      (key) => `compact.bothPassComparisons.${key}`,
    ),
  ].map((path) => `relationships.*.${path}.text`),
] as const;
export const GRAPH_FIELDS = [
  "measure.title",
  "summary.text",
  "summary.more",
  "background.text",
  "terms.*.term",
  "terms.*.plain",
  "nodes.*.label",
  "nodes.*.title",
  "nodes.*.body",
  "nodes.*.note",
  "nodes.*.highlight.reason",
  "nodes.*.context.period",
  "nodes.*.context.scope",
  "nodes.*.context.limitation",
  "edges.*.why",
] as const;

export function measureSegments(
  measure: unknown,
  graph: unknown,
  scope: "title" | "reader",
) {
  return [
    ...collectSegments(
      measure,
      scope === "title" ? ["title", "displayTitle"] : MEASURE_FIELDS,
      "measure",
    ),
    ...(scope === "reader"
      ? [
          ...collectSegments(graph, GRAPH_FIELDS, "graph"),
          ...moneyDisplaySegments(measure, "measure"),
          ...moneyDisplaySegments(graph, "graph"),
        ]
      : []),
  ];
}

/** Stable UUID namespace, separate from article IDs and from the title-only job. */
export function measureTranslationId(
  electionDate: string,
  number: string,
  scope: "title" | "reader",
) {
  const hex = createHash("sha256")
    .update(`billion:measure:${electionDate}:${number}:${scope}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Only run on already-published explanations, after their validation gates. */
export function withMoneyDisplay<T>(value: T): T {
  const copy = structuredClone(value);
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const money = contextMoneySchema.safeParse(item);
    if (money.success) {
      const { nominal, scope, comparison } = money.data;
      Object.assign(item, {
        display: {
          nominal,
          period: scope.period,
          jurisdiction: scope.jurisdiction,
          ...(comparison.state === "available"
            ? { denominatorName: comparison.denominator.name }
            : { reason: comparison.reason }),
        },
      });
      return;
    }
    for (const child of Object.values(item)) visit(child);
  };
  visit(copy);
  return copy;
}
function moneyDisplaySegments(
  value: unknown,
  prefix: string,
): { key: string; text: string }[] {
  if (!value || typeof value !== "object") return [];
  const money = contextMoneySchema.safeParse(value);
  if (money.success)
    return collectSegments(
      value,
      [
        "display.nominal",
        "display.period",
        "display.jurisdiction",
        "display.reason",
        "display.denominatorName",
      ],
      prefix,
    );
  return Object.entries(value).flatMap(([key, child]) =>
    moneyDisplaySegments(child, `${prefix}.${key}`),
  );
}
