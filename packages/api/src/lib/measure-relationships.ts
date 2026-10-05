import { createHash } from "node:crypto";

import type {
  MeasureRelationship,
  PublicMeasureRelationship,
} from "@acme/validators";
import {
  hasValidRelationshipEvidence,
  measureRelationshipSchema,
} from "@acme/validators";

import type { OfficialGuidePayload } from "./official-guide-cache";
import { relationshipRevisions } from "./measure-relationship-revisions/registry";
import { propositionGuideHash } from "./proposition-consequences";

export const relationshipHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const relationshipEvidenceHash = (draft: MeasureRelationship) =>
  relationshipHash(JSON.stringify({ ...draft, review: undefined }));
/** Immutable editorial store, pending revisions cannot publish before #334 review. No generation on reads. */
export const reviewedRelationshipRevisions: readonly unknown[] =
  relationshipRevisions;
export interface RelationshipSnapshot {
  url: string;
  hash: string;
}

/** Both measures and all four captured source revisions must still match. Fail closed. */
export function publishedMeasureRelationships(
  guide: OfficialGuidePayload,
  number: string,
  currentSources: readonly RelationshipSnapshot[],
  revisions: readonly unknown[] = reviewedRelationshipRevisions,
): PublicMeasureRelationship[] {
  const published: PublicMeasureRelationship[] = [];
  const seen = new Set<string>();
  for (const value of revisions) {
    const parsed = measureRelationshipSchema.safeParse(value);
    if (!parsed.success) continue;
    const draft = parsed.data;
    if (
      draft.electionDate !== guide.electionDate ||
      !draft.measures.some((m) => m.number === number) ||
      draft.measures[0].number === draft.measures[1].number
    )
      continue;
    if (!draft.compact) continue;
    const pair = draft.measures
      .map((m) => m.number)
      .sort()
      .join(":");
    if (seen.has(pair)) continue;
    if (
      draft.measures.some((m) => {
        const matches = guide.measures.filter(
          (item) => item.number === m.number,
        );
        const item = matches[0];
        return (
          matches.length !== 1 ||
          item?.title !== m.title ||
          item.sourceUrl !== m.url ||
          propositionGuideHash(guide.electionDate, item) !== m.guideHash
        );
      })
    )
      continue;
    if (
      draft.sources.some((source) => {
        const identity = draft.measures.find((m) => m.number === source.number);
        const measure = guide.measures.find((m) => m.number === source.number);
        return (
          !identity ||
          !measure ||
          (source.role === "legal-text"
            ? source.url !== measure.fullTextUrl
            : source.url !== `${identity.url}analysis.htm`)
        );
      })
    )
      continue;
    const sources = new Map(draft.sources.map((s) => [s.id, s]));
    if (
      sources.size !== draft.sources.length ||
      draft.sources.some(
        (s) =>
          relationshipHash(s.snapshot) !== s.hash ||
          !currentSources.some(
            (current) =>
              current.url === s.url && current.hash === s.documentHash,
          ),
      )
    )
      continue;
    if (
      draft.measures.some((m) =>
        ["legal-text", "official-analysis"].some(
          (role) =>
            !draft.sources.some(
              (s) => s.number === m.number && s.role === role,
            ),
        ),
      )
    )
      continue;
    if (
      draft.sources.some((s) => {
        const url = new URL(s.url);
        return (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          !["voterguide.sos.ca.gov", "vig.cdn.sos.ca.gov"].includes(
            url.hostname,
          )
        );
      })
    )
      continue;
    if (!hasValidRelationshipEvidence(draft)) continue;
    const review = draft.review;
    const reviewedAt = review.reviewedAt;
    if (
      review.state !== "approved" ||
      !review.reviewer ||
      !review.findings ||
      !reviewedAt ||
      review.revision !== draft.revision ||
      review.evidenceHash !== relationshipEvidenceHash(draft) ||
      draft.sources.some(
        (s) => Date.parse(s.retrievedAt) > Date.parse(reviewedAt),
      )
    )
      continue;
    seen.add(pair);
    published.push({
      ...draft,
      sources: draft.sources.map(
        ({ snapshot: _snapshot, ...source }) => source,
      ),
    });
  }
  return published;
}

export { propositionGuideHash } from "./proposition-consequences";

/** Ingestion refreshes document-byte hashes, independently of the approved capture. */
export function relationshipSourceUrls(
  electionDate: string,
  revisions: readonly unknown[] = reviewedRelationshipRevisions,
): string[] {
  const urls = new Set<string>();
  for (const value of revisions) {
    const parsed = measureRelationshipSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.review.state !== "approved" ||
      parsed.data.electionDate !== electionDate
    )
      continue;
    for (const s of parsed.data.sources) {
      const url = new URL(s.url);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        ["voterguide.sos.ca.gov", "vig.cdn.sos.ca.gov"].includes(url.hostname)
      )
        urls.add(s.url);
    }
  }
  if (urls.size > 200)
    throw new Error("Relationship registry exceeds 200 source documents");
  return [...urls];
}
