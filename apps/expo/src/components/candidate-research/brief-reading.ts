import type { CandidateBrief } from "@acme/validators";

export function readBrief(
  brief: Pick<CandidateBrief, "sections" | "research">,
  judicial = false,
) {
  const sections = judicial
    ? brief.sections.map((section) => ({
        ...section,
        claims: section.claims.filter((claim) => claim.kind !== "promise"),
      }))
    : brief.sections;
  const headline = judicial
    ? undefined
    : (sections
        .flatMap((section) => section.claims)
        .find((claim) => claim.id === brief.research?.headlineClaimId) ??
      sections.find((section) => section.topic === "priorities")?.claims[0]);
  return {
    headline,
    record: sections.find((section) => section.topic === "record"),
    chapters: sections.filter((section) => section.topic !== "record"),
    hasPromises: sections.some((section) =>
      section.claims.some((claim) => claim.kind === "promise"),
    ),
  };
}
