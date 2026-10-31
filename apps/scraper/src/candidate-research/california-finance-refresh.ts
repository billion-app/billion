import type {
  CandidateBrief,
  CandidateEvidenceDossier,
  CandidateModelAttestation,
} from "@acme/validators";
import {
  candidateBriefSchema,
  candidateModelAttestationSchema,
} from "@acme/validators";

import type { CaliforniaRetainedNarrative } from "./california-ai.js";
import {
  californiaAuthorEvidence,
  californiaAuthorOutputSchema,
} from "./california-ai.js";
import {
  evidenceDigest,
  validateBriefAgainstDossier,
  validateCaliforniaDossier,
} from "./california-dossier.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}
export function financeRefreshNonfinancialSources(
  dossier: CandidateEvidenceDossier,
) {
  const used = new Set(
    dossier.evidence
      .filter((entry) => entry.role !== "finance")
      .map((entry) => entry.sourceId),
  );
  for (const gap of dossier.gaps.filter((gap) => gap.dimension !== "finance"))
    for (const id of gap.checkedSourceIds) used.add(id);
  for (const link of dossier.sourceLinks ?? []) {
    used.add(link.fromSourceId);
    used.add(link.toSourceId);
  }
  const proof = dossier.financeIdentityProof;
  const financeIds = new Set(
    dossier.evidence
      .filter((entry) => entry.role === "finance")
      .map((entry) => entry.sourceId),
  );
  for (const gap of dossier.gaps.filter((gap) => gap.dimension === "finance"))
    for (const id of gap.checkedSourceIds) financeIds.add(id);
  if (proof) {
    financeIds.add(proof.sourceId);
    if (proof.bridge?.kind === "official_domain_v1") {
      financeIds.add(proof.bridge.rosterSourceId);
      financeIds.add(proof.bridge.filingSourceId);
    }
    if (proof.bridge?.kind === "sos_legal_name_v1")
      financeIds.add(proof.bridge.sourceId);
  }
  return dossier.sources.filter(
    (source) =>
      used.has(source.id) ||
      (!financeIds.has(source.id) &&
        !(
          /^fec-[a-f0-9]{20}$/.test(source.id) &&
          /(^|\.)fec\.gov$/.test(new URL(source.url).hostname)
        )),
  );
}
export function refreshableUnusedDiscoverySource(
  dossier: CandidateEvidenceDossier,
  source: Pick<
    CandidateEvidenceDossier["sources"][number],
    "id" | "url" | "publisher" | "format" | "binaryBase64"
  >,
) {
  const host = new URL(source.url).hostname;
  return (
    /^source-[a-f0-9]{24}$/.test(source.id) &&
    source.publisher === host &&
    ["html", "text"].includes(source.format) &&
    !source.binaryBase64 &&
    !/(^|\.)gov(?:\.[a-z]{2})?$/.test(host) &&
    !dossier.evidence.some((entry) => entry.sourceId === source.id) &&
    !dossier.gaps.some((gap) => gap.checkedSourceIds.includes(source.id)) &&
    !(dossier.sourceLinks ?? []).some(
      (link) =>
        link.fromSourceId === source.id || link.toSourceId === source.id,
    ) &&
    dossier.campaignContactProof?.destinationSourceId !== source.id &&
    dossier.campaignContactProof?.officialSource.url !== source.url
  );
}
export function financeRefreshNonfinancialProjection(
  dossier: CandidateEvidenceDossier,
) {
  const {
    finance: _finance,
    financeIdentityProof: _proof,
    sourceSetDigest: _sourceDigest,
    dossierDigest: _digest,
    createdAt: _created,
    sources: _sources,
    evidence,
    gaps,
    campaignContactProof,
    ...context
  } = dossier;
  const nonfinancialEvidence = evidence.filter(
    (entry) => entry.role !== "finance",
  );
  const retainedSources = financeRefreshNonfinancialSources(dossier);
  return canonical({
    ...context,
    evidence: nonfinancialEvidence,
    sources: retainedSources
      .map(({ fetchedAt: _fetched, ...source }) => {
        if (["html", "text"].includes(source.format) && !source.binaryBase64) {
          const {
            byteHash: _byteHash,
            retrievalUrls: _retrieval,
            ...semantic
          } = source;
          if (refreshableUnusedDiscoverySource(dossier, source)) {
            const {
              text: _text,
              contentHash: _contentHash,
              ...discovery
            } = semantic;
            return discovery;
          }
          return semantic;
        }
        return source;
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
    gaps: gaps.filter((gap) => gap.dimension !== "finance"),
    ...(campaignContactProof
      ? {
          campaignContactProof: {
            ...campaignContactProof,
            officialSource: {
              ...campaignContactProof.officialSource,
              fetchedAt: undefined,
            },
          },
        }
      : {}),
  });
}
export interface PublishedFinanceRefreshMember {
  candidateId: string;
  revisionId: string;
  collectionId: string | null;
  brief?: CandidateBrief | null;
  author: CandidateModelAttestation | null;
  reviewer: CandidateModelAttestation | null;
}
export function qualifyPublishedFinanceNarrative(input: {
  member: PublishedFinanceRefreshMember;
  previousDossier: CandidateEvidenceDossier;
  dossier: CandidateEvidenceDossier;
  policyVersion: string;
}): CaliforniaRetainedNarrative | undefined {
  try {
    const { member, policyVersion } = input;
    const previous = validateCaliforniaDossier(input.previousDossier);
    const dossier = validateCaliforniaDossier(input.dossier);
    const brief = candidateBriefSchema.parse(member.brief);
    const author = candidateModelAttestationSchema.parse(member.author);
    const reviewer = candidateModelAttestationSchema.parse(member.reviewer);
    const digest = evidenceDigest(brief);
    if (
      !member.collectionId ||
      member.candidateId !== dossier.identity.candidateId ||
      member.revisionId !== brief.revisionId ||
      author.role !== "author" ||
      reviewer.role !== "reviewer" ||
      author.actorId !== brief.authorId ||
      author.runId === reviewer.runId ||
      author.actorId === reviewer.actorId ||
      author.revisionDigest !== digest ||
      reviewer.revisionDigest !== digest ||
      author.dossierDigest !== previous.dossierDigest ||
      reviewer.dossierDigest !== previous.dossierDigest ||
      author.sourceSetDigest !== previous.sourceSetDigest ||
      reviewer.sourceSetDigest !== previous.sourceSetDigest ||
      author.policyVersion !== policyVersion ||
      reviewer.policyVersion !== policyVersion ||
      brief.authorship?.kind !== "generated" ||
      brief.authorship.model !== author.actualModel ||
      brief.authorship.promptVersion !== author.promptVersion ||
      previous.officeKind !== "federal_legislative" ||
      evidenceDigest(financeRefreshNonfinancialProjection(previous)) !==
        evidenceDigest(financeRefreshNonfinancialProjection(dossier))
    )
      return undefined;
    validateBriefAgainstDossier(brief, previous);
    const promises = brief.research?.promises ?? [];
    if (
      new Set(promises.map((promise) => promise.claimId)).size !==
      promises.length
    )
      return undefined;
    const claimedPromises = new Set<string>();
    const narrative = californiaAuthorOutputSchema(
      californiaAuthorEvidence(dossier),
    ).parse({
      ...Object.fromEntries(
        brief.sections.map((section) => [
          section.topic,
          {
            claims: section.claims.map((claim) => {
              if (
                claim.evidenceIds.some(
                  (id) =>
                    dossier.evidence.find((entry) => entry.id === id)?.role ===
                    "finance",
                )
              )
                throw new Error(
                  "Finance claim cannot be retained as political narrative",
                );
              if (claim.emphasis?.length)
                throw new Error(
                  "Authored emphasis cannot be reconstructed by the narrative compiler",
                );
              const details = promises.find(
                (promise) => promise.claimId === claim.id,
              );
              if (details) claimedPromises.add(details.claimId);
              const { claimId: _id, ...promiseDetails } = details ?? {
                claimId: claim.id,
              };
              const point = (
                value: NonNullable<
                  CandidateBrief["research"]
                >["promises"][number]["brief"]["change"],
              ) => {
                if (value.emphasis.length)
                  throw new Error(
                    "Promise emphasis cannot be reconstructed by the narrative compiler",
                  );
                const { emphasis: _emphasis, ...prose } = value;
                return prose;
              };
              const retainedDetails = details
                ? {
                    ...promiseDetails,
                    brief: {
                      change: point(details.brief.change),
                      authority: point(details.brief.authority),
                      unknowns: point(details.brief.unknowns),
                    },
                    benefits: details.benefits.map(point),
                    costs: details.costs.map(point),
                    affected: details.affected.map(point),
                    perspectives: details.perspectives.map(point),
                    steps: details.steps.map(point),
                    alternatives: details.alternatives.map(point),
                    unknowns: details.unknowns.map(point),
                  }
                : null;
              return {
                kind: claim.kind,
                text: claim.text,
                evidenceIds: claim.evidenceIds,
                ...(claim.kind === "promise"
                  ? { promiseDetails: retainedDetails }
                  : {}),
              };
            }),
          },
        ]),
      ),
      terms: brief.research?.terms ?? [],
    });
    if (claimedPromises.size !== promises.length) return undefined;
    return {
      dossierDigest: dossier.dossierDigest,
      narrative,
      semanticDigest: evidenceDigest(narrative),
      publication: {
        revisionId: brief.revisionId,
        authorRunId: author.runId,
        reviewerRunId: reviewer.runId,
      },
    };
  } catch {
    return undefined;
  }
}
