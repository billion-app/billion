import { z } from "zod/v4";

const text = z.string().trim().min(1).max(2000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const claim = z.object({ text, sourceIds: z.array(z.string()).min(1) });
export const measureRelationshipSchema = z.object({
  schemaVersion: z.literal(1),
  revision: text,
  jurisdiction: z.literal("CA"),
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["conflict", "precedence", "dependency", "uncertain"]),
  measures: z.tuple([
    z.object({ number: text, title: text, url: z.url(), guideHash: hash }),
    z.object({ number: text, title: text, url: z.url(), guideHash: hash }),
  ]),
  sources: z
    .array(
      z.object({
        id: text,
        number: text,
        role: z.enum(["legal-text", "official-analysis"]),
        url: z.url(),
        locator: text,
        retrievedAt: z.iso.datetime(),
        snapshot: z.string().min(1).max(200000),
        hash,
        documentHash: hash,
      }),
    )
    .min(4)
    .max(20),
  takeaway: claim,
  affectedProvisions: z.array(claim).min(1),
  scenarios: z.object({
    neither: claim,
    onlyFirst: claim,
    onlySecond: claim,
    both: claim,
  }),
  conditions: z.array(claim).min(1),
  compact: z
    .object({
      measures: z.tuple([
        claim.extend({ text: text.max(70) }),
        claim.extend({ text: text.max(70) }),
      ]),
      takeaway: claim.extend({ text: text.max(140) }),
      scenarios: z.object({
        neither: z.object({
          title: claim.extend({ text: text.max(80) }),
          consequence: claim.extend({ text: text.max(220) }),
        }),
        onlyFirst: z.object({
          title: claim.extend({ text: text.max(80) }),
          consequence: claim.extend({ text: text.max(220) }),
        }),
        onlySecond: z.object({
          title: claim.extend({ text: text.max(80) }),
          consequence: claim.extend({ text: text.max(220) }),
        }),
        both: z.object({
          title: claim.extend({ text: text.max(80) }),
          consequence: claim.extend({ text: text.max(220) }),
        }),
      }),
      bothPassComparisons: z
        .object({
          firstMore: claim.extend({ text: text.max(220) }),
          secondMore: claim.extend({ text: text.max(220) }),
          equal: claim.extend({ text: text.max(220) }),
        })
        .optional(),
      provisions: z.tuple([
        claim.extend({ text: text.max(180) }),
        claim.extend({ text: text.max(180) }),
      ]),
      conflictScopes: z
        .object({
          condition: claim.extend({ text: text.max(220) }),
          scopes: z.tuple([
            claim.extend({ text: text.max(180) }),
            claim.extend({ text: text.max(180) }),
          ]),
        })
        .optional(),
    })
    .optional(),
  generation: z
    .object({
      promptVersion: text,
      model: text,
      inputHash: hash,
      generatedAt: z.iso.datetime(),
      warrants: z
        .array(
          z.object({ sourceId: text, quote: text.max(1000), locator: text }),
        )
        .min(2)
        .max(12),
    })
    .optional(),
  review: z.object({
    state: z.enum(["pending", "approved", "rejected"]),
    reviewer: text.optional(),
    reviewedAt: z.iso.datetime().optional(),
    revision: text.optional(),
    evidenceHash: hash.optional(),
    findings: text.optional(),
  }),
});
export type MeasureRelationship = z.infer<typeof measureRelationshipSchema>;
export type PublicMeasureRelationship = Omit<MeasureRelationship, "sources"> & {
  sources: Omit<MeasureRelationship["sources"][number], "snapshot">[];
};

/** All reader claims participate in citation and editorial approval checks. */
export function measureRelationshipClaims(draft: MeasureRelationship) {
  const compact = draft.compact;
  return [
    draft.takeaway,
    ...draft.affectedProvisions,
    ...Object.values(draft.scenarios),
    ...draft.conditions,
    ...(compact
      ? [
          ...compact.measures,
          compact.takeaway,
          ...Object.values(compact.scenarios).flatMap((s) => [
            s.title,
            s.consequence,
          ]),
          ...compact.provisions,
          ...Object.values(compact.bothPassComparisons ?? {}),
          ...(compact.conflictScopes
            ? [
                compact.conflictScopes.condition,
                ...compact.conflictScopes.scopes,
              ]
            : []),
        ]
      : []),
  ];
}
export function hasValidRelationshipEvidence(draft: MeasureRelationship) {
  const sources = new Map(draft.sources.map((s) => [s.id, s]));
  if (
    sources.size !== draft.sources.length ||
    measureRelationshipClaims(draft).some((c) =>
      c.sourceIds.some((id) => !sources.has(id)),
    )
  )
    return false;
  const warrants = draft.generation?.warrants;
  return (
    !warrants ||
    (warrants.every((w) =>
      sources.get(w.sourceId)?.snapshot.includes(w.quote),
    ) &&
      draft.measures.every((m) =>
        warrants.some(
          (w) =>
            sources.get(w.sourceId)?.number === m.number &&
            sources.get(w.sourceId)?.role === "legal-text",
        ),
      ))
  );
}
